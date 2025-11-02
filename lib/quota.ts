// lib/quota.ts
import "server-only";
import { addUsage, getUsage } from "./quota-db";

export const METHOD_COST = {
  "playlistItems.list": 1,
  "playlistItems.insert": 50,
  "playlistItems.delete": 50,
  "playlists.list": 1,
} as const;

export type MethodName = keyof typeof METHOD_COST;

const DAILY_BUDGET =
  Number(
    process.env.YTPM_DAILY_QUOTA ?? process.env.NEXT_PUBLIC_YTPM_DAILY_QUOTA
  ) || 10_000;

/* ===========================
 *  ✅ Pacific Time helpers
 * =========================== */

/** 產生 PT（美國太平洋時間）當日 key：YYYY-MM-DD */
function todayKeyPT() {
  const now = new Date();
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // en-CA format = 2025-11-02
}

/**
 * 回傳下次「PT 午夜」的 ISO 字串，例如:
 *  2025-11-03T00:00:00-07:00
 *  2025-12-01T00:00:00-08:00
 * 會自動處理 DST（夏令/冬令）
 */
function nextResetAtISO_PT() {
  // 把系統時間轉成 PT local time
  const nowPT = new Date(
    new Date().toLocaleString("en-US", { timeZone: "America/Los_Angeles" })
  );

  const nextPT = new Date(nowPT);
  nextPT.setDate(nowPT.getDate() + 1);
  nextPT.setHours(0, 0, 0, 0);

  // 取出 PT offset，例如 "GMT-07:00"
  const offsetText = nextPT
    .toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
      timeZoneName: "shortOffset",
      hour12: false,
    })
    .match(/GMT([+-]\d{2}):?(\d{2})?$/);

  const yyyy = nextPT.getFullYear();
  const mm = String(nextPT.getMonth() + 1).padStart(2, "0");
  const dd = String(nextPT.getDate()).padStart(2, "0");

  const offset =
    offsetText && offsetText[1]
      ? `${offsetText[1]}:${offsetText[2] ?? "00"}`
      : "-08:00"; // default PST fallback

  return `${yyyy}-${mm}-${dd}T00:00:00${offset}`;
}

/* ======================================================
 *  ✅ 主要 API：寫入/讀取每日配額 (依 PT 重置)
 * ====================================================== */

/** 寫入配額（同時寫 global 與 userId） */
export function recordQuota(
  _method: MethodName | string,
  units: number,
  userId?: string
) {
  const n = Math.max(0, Math.floor(units || 0));
  if (!n) return;

  const tk = todayKeyPT(); // ✅ 改 PT
  addUsage(tk, "global", n);
  if (userId) addUsage(tk, userId, n);
}

/** 讀取今日配額統計（若 user 沒資料 → 回退 global） */
export function getTodayQuota(userId?: string) {
  const tk = todayKeyPT(); // ✅ 改 PT
  const resetAtISO = nextResetAtISO_PT(); // ✅ 改 PT

  const globalUsed = getUsage(tk, "global");
  const userUsed = userId ? getUsage(tk, userId) : undefined;

  const used = userUsed !== undefined && userUsed > 0 ? userUsed : globalUsed;
  const budget = DAILY_BUDGET;
  const remain = Math.max(0, budget - used);

  return { used, remain, budget, resetAtISO };
}

/** 保留舊 API，但它不寫扣點（扣點請用 recordQuota） */
export function runWithQuota<T>(
  _method: MethodName | string,
  _cost: number,
  fn: () => Promise<T>
): Promise<T> {
  return fn();
}
