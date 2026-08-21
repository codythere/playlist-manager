// lib/actions-store.ts (Postgres 版)
import { nanoid } from "nanoid";
import { query, withTransaction } from "@/lib/db";
import { addGlobalVideoOps } from "@/lib/video-ops";
import type {
  ActionCounts,
  ActionItemRecord,
  ActionItemStatus,
  ActionRecord,
  ActionStatus,
  ActionType,
} from "@/types/actions";

type IsoLike = string | Date | null;

// 將資料庫回傳的時間（可能是字串）轉成 ISO 字串
function toIsoUtc(ts: IsoLike): string | null {
  if (!ts) return null;
  const d = typeof ts === "string" ? new Date(ts) : ts;
  return d.toISOString();
}

interface ActionRow {
  id: string;
  user_id: string | null;
  type: ActionType;
  source_playlist_id: string | null;
  target_playlist_id: string | null;
  status: ActionStatus;
  created_at: string | Date;
  finished_at: string | Date | null;
  parent_action_id: string | null;
}

interface ActionItemRow {
  id: string;
  action_id: string;
  type: ActionType;
  video_id: string | null;
  source_playlist_id: string | null;
  target_playlist_id: string | null;
  source_playlist_item_id: string | null;
  target_playlist_item_id: string | null;
  position: number | null;
  status: ActionItemStatus;
  error_code: string | null;
  error_message: string | null;
  created_at: string | Date | null;
}

function mapAction(row: ActionRow): ActionRecord {
  return {
    id: row.id,
    userId: row.user_id ?? "",
    type: row.type,
    sourcePlaylistId: row.source_playlist_id ?? null,
    targetPlaylistId: row.target_playlist_id ?? null,
    status: row.status,
    createdAt: toIsoUtc(row.created_at)!,
    finishedAt: toIsoUtc(row.finished_at),
    parentActionId: row.parent_action_id ?? null,
  };
}

function mapActionItem(row: ActionItemRow): ActionItemRecord {
  return {
    id: row.id,
    actionId: row.action_id,
    type: row.type,
    videoId: row.video_id ?? null,
    sourcePlaylistId: row.source_playlist_id ?? null,
    targetPlaylistId: row.target_playlist_id ?? null,
    sourcePlaylistItemId: row.source_playlist_item_id ?? null,
    targetPlaylistItemId: row.target_playlist_item_id ?? null,
    position: row.position ?? null,
    status: row.status,
    errorCode: row.error_code ?? null,
    errorMessage: row.error_message ?? null,
  };
}

/** 建立一筆 action */
export async function createAction(params: {
  id?: string;
  userId: string;
  type: ActionType;
  sourcePlaylistId?: string | null;
  targetPlaylistId?: string | null;
  status?: ActionStatus;
  parentActionId?: string | null;
}): Promise<ActionRecord> {
  const id = params.id ?? nanoid();
  const status = params.status ?? "pending";

  const { rows } = await query<ActionRow>(
    `INSERT INTO actions (
       id, user_id, type, source_playlist_id, target_playlist_id, status, created_at, parent_action_id
     ) VALUES ($1,$2,$3,$4,$5,$6, now(), $7)
     RETURNING *`,
    [
      id,
      params.userId,
      params.type,
      params.sourcePlaylistId ?? null,
      params.targetPlaylistId ?? null,
      status,
      params.parentActionId ?? null,
    ],
  );
  if (!rows[0]) throw new Error("Failed to insert action");
  return mapAction(rows[0]);
}

/** 更新 action 狀態 */
export async function setActionStatus(
  id: string,
  status: ActionStatus,
  finishedAt?: string | null,
) {
  const { rows } = await query<ActionRow>(
    `UPDATE actions
       SET status = $1,
           finished_at = COALESCE($2::timestamptz, finished_at)
     WHERE id = $3
     RETURNING *`,
    [status, finishedAt ?? null, id],
  );
  if (!rows[0]) throw new Error("Failed to update action");
  return mapAction(rows[0]);
}

/** 批次建立 action_items（交易） */
export async function createActionItems(
  items: Array<{
    id?: string;
    actionId: string;
    type: ActionType;
    videoId?: string | null;
    sourcePlaylistId?: string | null;
    targetPlaylistId?: string | null;
    sourcePlaylistItemId?: string | null;
    targetPlaylistItemId?: string | null;
    position?: number | null;
    status?: ActionItemStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
  }>,
) {
  const created: ActionItemRecord[] = [];
  await withTransaction(async (client) => {
    for (const item of items) {
      const id = item.id ?? nanoid();
      const { rows } = await client.query<ActionItemRow>(
        `INSERT INTO action_items (
           id, action_id, type, video_id,
           source_playlist_id, target_playlist_id,
           source_playlist_item_id, target_playlist_item_id,
           position, status, error_code, error_message, created_at
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
         RETURNING *`,
        [
          id,
          item.actionId,
          item.type,
          item.videoId ?? null,
          item.sourcePlaylistId ?? null,
          item.targetPlaylistId ?? null,
          item.sourcePlaylistItemId ?? null,
          item.targetPlaylistItemId ?? null,
          item.position ?? null,
          item.status ?? "pending",
          item.errorCode ?? null,
          item.errorMessage ?? null,
        ],
      );
      if (rows[0]) created.push(mapActionItem(rows[0]));
    }
  });
  return created;
}

/** 更新 action_item 單筆 */
export async function updateActionItem(
  id: string,
  updates: {
    status?: ActionItemStatus;
    errorCode?: string | null;
    errorMessage?: string | null;
    targetPlaylistItemId?: string | null;
  },
) {
  // 取原資料
  const prev = await query<ActionItemRow>(
    `SELECT * FROM action_items WHERE id = $1`,
    [id],
  );
  const existing = prev.rows[0];
  const prevStatus = existing.status;
  if (!existing) return null;

  const mergedStatus = updates.status ?? existing.status;
  const mergedCode = updates.errorCode ?? existing.error_code ?? null;
  const mergedMsg = updates.errorMessage ?? existing.error_message ?? null;
  const mergedTarget =
    updates.targetPlaylistItemId ?? existing.target_playlist_item_id ?? null;

  // ✅ 只有第一次從非 success → success 才累加，避免重試重複加總
  if (prevStatus !== "success" && mergedStatus === "success") {
    // 你要算全站總數 + undo 也算，所以不篩 type，直接 +1
    await addGlobalVideoOps(1);
  }

  const { rows } = await query<ActionItemRow>(
    `UPDATE action_items
       SET status = $1,
           error_code = $2,
           error_message = $3,
           target_playlist_item_id = $4
     WHERE id = $5
     RETURNING *`,
    [mergedStatus, mergedCode, mergedMsg, mergedTarget, id],
  );
  return rows[0] ? mapActionItem(rows[0]) : null;
}

export async function listActionItems(actionId: string) {
  const { rows } = await query<ActionItemRow>(
    `SELECT * FROM action_items
      WHERE action_id = $1
      ORDER BY created_at ASC, id ASC`,
    [actionId],
  );
  return rows.map(mapActionItem);
}

export async function getActionById(id: string) {
  const { rows } = await query<ActionRow>(
    `SELECT * FROM actions WHERE id = $1`,
    [id],
  );
  return rows[0] ? mapAction(rows[0]) : null;
}

/** 原本的 listActions（cursor = action.id）*/
export async function listActions(
  userId: string,
  limit: number,
  cursor?: string | null,
) {
  let cursorTs: string | null = null;
  if (cursor) {
    const cur = await query<{ created_at: string }>(
      `SELECT created_at FROM actions WHERE id = $1`,
      [cursor],
    );
    cursorTs = cur.rows[0]?.created_at ?? null;
  }

  const { rows } = await query<ActionRow>(
    `SELECT * FROM actions
       WHERE user_id = $1
         AND ($2::timestamptz IS NULL OR created_at < $2)
       ORDER BY created_at DESC
       LIMIT $3`,
    [userId, cursorTs, Math.max(1, limit)],
  );
  return rows.map(mapAction);
}

/** 統計某 action 的 item 成功/失敗/總數 */
export async function getActionCounts(actionId: string): Promise<ActionCounts> {
  const { rows } = await query<{
    total: string;
    success: string;
    failed: string;
  }>(
    `SELECT
       COUNT(*)::bigint as total,
       SUM(CASE WHEN status='success' THEN 1 ELSE 0 END)::bigint as success,
       SUM(CASE WHEN status='failed'  THEN 1 ELSE 0 END)::bigint as failed
     FROM action_items
     WHERE action_id = $1`,
    [actionId],
  );
  const r = rows[0] ?? { total: "0", success: "0", failed: "0" };
  return {
    total: Number(r.total || 0),
    success: Number(r.success || 0),
    failed: Number(r.failed || 0),
  };
}

/**
 * 一次取得多筆 action 的即時進度。
 *
 * 供進行中的批次操作輪詢用，所以刻意做成單一查詢，避免每個 action 各佔一條
 * 連線（bulk 路由執行期間會長時間佔用連線池）。
 * `inserted` 用於 MOVE：插入目標與刪除來源是兩個階段，只看 success 會讓進度
 * 在前半段完全不動。
 */
export interface ActionProgressRecord {
  id: string;
  type: ActionType;
  status: ActionStatus;
  total: number;
  success: number;
  failed: number;
  inserted: number;
}

export async function getActionsProgress(
  actionIds: string[],
  userId: string,
): Promise<ActionProgressRecord[]> {
  if (actionIds.length === 0) return [];

  const { rows } = await query<{
    id: string;
    type: ActionType;
    status: ActionStatus;
    total: string;
    success: string;
    failed: string;
    inserted: string;
  }>(
    `SELECT
       a.id,
       a.type,
       a.status,
       COUNT(ai.id)::bigint AS total,
       COALESCE(SUM(CASE WHEN ai.status='success' THEN 1 ELSE 0 END), 0)::bigint AS success,
       COALESCE(SUM(CASE WHEN ai.status='failed'  THEN 1 ELSE 0 END), 0)::bigint AS failed,
       COALESCE(SUM(CASE WHEN ai.target_playlist_item_id IS NOT NULL THEN 1 ELSE 0 END), 0)::bigint AS inserted
     FROM actions a
     LEFT JOIN action_items ai ON ai.action_id = a.id
     WHERE a.id = ANY($1::text[]) AND a.user_id = $2
     GROUP BY a.id, a.type, a.status`,
    [actionIds, userId],
  );

  return rows.map((r) => ({
    id: r.id,
    type: r.type,
    status: r.status,
    total: Number(r.total || 0),
    success: Number(r.success || 0),
    failed: Number(r.failed || 0),
    inserted: Number(r.inserted || 0),
  }));
}

/** /api/actions 使用的安全版分頁（抓 limit+1 判斷 hasMore） */
export async function listActionsPageSafe(
  userId: string,
  limit: number,
  cursor?: string | null,
) {
  return listActions(userId, limit, cursor);
}

/** Items 分頁（以 created_at,id 升冪；cursor = 上一頁最後一筆的 id） */
export async function listActionItemsPageSafe(
  actionId: string,
  limit: number,
  cursor?: string | null,
): Promise<{ items: ActionItemRecord[]; nextCursor: string | null }> {
  let cursorCreatedAt: string | null = null;
  let cursorId: string | null = null;

  if (cursor) {
    const cur = await query<{ created_at: string; id: string }>(
      `SELECT created_at, id FROM action_items WHERE id = $1`,
      [cursor],
    );
    if (cur.rows[0]) {
      cursorCreatedAt = cur.rows[0].created_at;
      cursorId = cur.rows[0].id;
    }
  }

  const { rows } = await query<ActionItemRow>(
    `SELECT * FROM action_items
       WHERE action_id = $1
         AND (
           $2::timestamptz IS NULL
           OR (created_at, id) > ($2::timestamptz, $3::text)
         )
       ORDER BY created_at ASC, id ASC
       LIMIT $4`,
    [actionId, cursorCreatedAt, cursorId, Math.max(1, limit + 1)],
  );

  const hasMore = rows.length > limit;
  const pageRows = hasMore ? rows.slice(0, limit) : rows;
  const items = pageRows.map(mapActionItem);
  const nextCursor = hasMore ? pageRows[pageRows.length - 1].id : null;
  return { items, nextCursor };
}
