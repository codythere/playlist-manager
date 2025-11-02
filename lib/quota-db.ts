// lib/quota-db.ts
import { db } from "./db";

/**
 * 本模組目標：
 * - quota_usage：持久化每日配額使用量（date_key = "YYYY-MM-DD" in PT）
 * - quota_meta：儲存維護資訊（最後 VACUUM / PRUNE 的日期）
 * - 自動清理：只保留最近 N 天的資料（預設 35 天）
 * - 自動 VACUUM：定期回收檔案空間（預設每 7 天一次）
 * - 加速：設定 PRAGMA 與索引
 *
 * 註：本模組為同步 API（better-sqlite3），可安全於 API route 內呼叫。
 */

/* ===========================
 *  PT（Pacific Time）工具
 * =========================== */

/** 取得 PT 當天日期字串：YYYY-MM-DD */
function todayKeyPT(): string {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // e.g. 2025-11-02
}

/** 取得 PT （今天 - N 天）的日期字串：YYYY-MM-DD */
function pastKeyPT(days: number): string {
  const nowPT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );
  const cut = new Date(nowPT);
  cut.setDate(nowPT.getDate() - Math.max(0, Math.floor(days || 0)));
  const yyyy = cut.getFullYear();
  const mm = String(cut.getMonth() + 1).padStart(2, "0");
  const dd = String(cut.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/* ===========================
 *  資料表與索引
 * =========================== */

function ensurePragmas() {
  // 合理的預設：WAL 可提升並發；NORMAL 減少 fsync；mmap_size 視環境自訂
  try {
    db.pragma("journal_mode = WAL");
    db.pragma("synchronous = NORMAL");
    db.pragma("temp_store = MEMORY");
    // 可選：db.pragma("mmap_size = 268435456"); // 256MB
  } catch {
    // 某些環境（唯讀 / 限制）可能無法設定，忽略即可
  }
}

/** quota_usage：PRIMARY KEY(date_key, scope) 已涵蓋我們常見的查詢 */
function ensureQuotaSchema() {
  ensurePragmas();

  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS quota_usage (
      date_key TEXT NOT NULL,
      scope    TEXT NOT NULL,
      used     INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (date_key, scope)
    )
  `
  ).run();

  // meta 資訊（儲存最後維護日期等）
  db.prepare(
    `
    CREATE TABLE IF NOT EXISTS quota_meta (
      key   TEXT PRIMARY KEY,
      value TEXT
    )
  `
  ).run();

  // 雖然有 PK(date_key, scope)，但若未來要做 scope 篩選趨勢，可加覆合索引（可選）
  db.prepare(
    `
    CREATE INDEX IF NOT EXISTS idx_quota_scope_date ON quota_usage(scope, date_key)
  `
  ).run();
}

/* ===========================
 *  Meta 讀寫
 * =========================== */

function getMeta(key: string): string | null {
  const row = db
    .prepare(`SELECT value FROM quota_meta WHERE key = ?`)
    .get(key) as { value: string } | undefined;
  return row?.value ?? null;
}

function setMeta(key: string, value: string) {
  db.prepare(
    `
    INSERT INTO quota_meta (key, value)
    VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `
  ).run(key, value);
}

/* ===========================
 *  維護：Prune + Vacuum
 * =========================== */

export interface MaintenanceOptions {
  /** 保留天數（含今天），預設 35 天 */
  retentionDays?: number;
  /** VACUUM 週期（天），預設 7 天 */
  vacuumIntervalDays?: number;
}

const DEFAULT_RETENTION_DAYS = 35;
const DEFAULT_VACUUM_INTERVAL_DAYS = 7;

// 簡單的行程內節流，避免高頻 API 下每次都清
let _lastMaintenanceMs = 0;

/** 刪除過期資料（只保留最近 N 天） */
function pruneOldUsage(retentionDays: number) {
  const cutoff = pastKeyPT(retentionDays);
  // YYYY-MM-DD 字串可直接用字典序比較
  db.prepare(`DELETE FROM quota_usage WHERE date_key < ?`).run(cutoff);
  setMeta("last_prune_pt", todayKeyPT());
}

/** 若距離上次 VACUUM 超過 intervalDays，則執行 VACUUM */
function maybeVacuum(intervalDays: number) {
  const last = getMeta("last_vacuum_pt");
  const need =
    !last ||
    // 字串比較不準，轉 Date 比較天數
    (() => {
      const lastDate = new Date(`${last}T00:00:00Z`); // 以 UTC 解析 meta 字串（其實是 PT date）
      const now = new Date();
      const diffDays = (now.getTime() - lastDate.getTime()) / 86400000;
      return diffDays >= intervalDays - 0.001;
    })();

  if (need) {
    try {
      // VACUUM 不能在交易中
      db.exec("VACUUM");
      setMeta("last_vacuum_pt", todayKeyPT());
    } catch {
      // 某些環境（只讀 / busy）可能失敗，忽略即可；下次再嘗試
    }
  }
}

/**
 * 輕量維護：
 * - 每隔 ~1 小時最多跑一次（行程內節流）
 * - 執行：Prune（保留最近 N 天） + 週期性 VACUUM
 */
function maintainQuotaStore(opts?: MaintenanceOptions) {
  const now = Date.now();
  if (now - _lastMaintenanceMs < 60 * 60 * 1000) return; // 1hr 節流
  _lastMaintenanceMs = now;

  const retentionDays = opts?.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const vacuumEvery = opts?.vacuumIntervalDays ?? DEFAULT_VACUUM_INTERVAL_DAYS;

  try {
    pruneOldUsage(retentionDays);
  } catch {
    // ignore
  }
  try {
    maybeVacuum(vacuumEvery);
  } catch {
    // ignore
  }
}

/* ===========================
 *  對外 API（與原介面相容）
 * =========================== */

/** 呼叫此函式以確保資料表存在（供其他模組在冷啟時使用） */
export function ensureQuotaTables() {
  ensureQuotaSchema();
}

/** 新增使用量（累加），同時啟用輕量維護 */
export function addUsage(dateKey: string, scope: string, delta: number) {
  ensureQuotaSchema();

  db.prepare(
    `
    INSERT INTO quota_usage (date_key, scope, used)
    VALUES (@date_key, @scope, @delta)
    ON CONFLICT(date_key, scope)
    DO UPDATE SET used = quota_usage.used + excluded.used
  `
  ).run({
    date_key: dateKey,
    scope,
    delta: Math.max(0, Math.floor(delta || 0)),
  });

  // 低頻率觸發維護（不阻塞主要邏輯）
  maintainQuotaStore();
}

/** 讀取當日某 scope 用量 */
export function getUsage(dateKey: string, scope: string): number {
  ensureQuotaSchema();
  const row = db
    .prepare(`SELECT used FROM quota_usage WHERE date_key = ? AND scope = ?`)
    .get(dateKey, scope) as { used: number } | undefined;
  return row?.used ?? 0;
}

/* ===========================
 *  進階：可選外部手動維護 API
 * =========================== */

/** 手動進行清理與壓縮（例如管理端按鈕或 cron 呼叫） */
export function maintenance(options?: MaintenanceOptions) {
  ensureQuotaSchema();
  pruneOldUsage(options?.retentionDays ?? DEFAULT_RETENTION_DAYS);
  maybeVacuum(options?.vacuumIntervalDays ?? DEFAULT_VACUUM_INTERVAL_DAYS);
}
