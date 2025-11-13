import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { jsonError, jsonOk } from "@/lib/result";
import { bulkAddSchema } from "@/validators/bulk";
import { performBulkAdd, getActionSummary } from "@/lib/actions-service";
import { checkIdempotencyKey, registerIdempotencyKey } from "@/lib/idempotency";
import { requireUserId } from "@/lib/auth";
import { getUserTokens } from "@/lib/google";
import { logger } from "@/lib/logger";
import { withTransaction } from "@/lib/db";
import type { ActionItemRecord } from "@/types/actions";

export const dynamic = "force-dynamic";

// 讓 HomeClient 那邊的 AddApiResult 型別可以對得上
type CreatedItem = {
  playlistItemId?: string | null;
  videoId?: string | null;
};

function buildCreated(
  items: ActionItemRecord[] | undefined | null
): CreatedItem[] {
  if (!items) return [];
  return items
    .filter(
      (it) =>
        it.type === "ADD" &&
        it.status === "success" &&
        !!it.targetPlaylistItemId
    )
    .map((it) => ({
      playlistItemId: it.targetPlaylistItemId,
      videoId: it.videoId,
    }));
}

async function getUserIdFromRequest(req: NextRequest): Promise<string | null> {
  try {
    const u = await requireUserId(req as any);
    if (u?.userId) return u.userId;
  } catch {}
  try {
    const store = await cookies();
    const raw = store.get("ytpm_session")?.value;
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed?.userId) return String(parsed.userId);
    }
  } catch {}
  return null;
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_request", "Invalid JSON body", { status: 400 });
  }

  const parsed = bulkAddSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", parsed.error.message, { status: 400 });
  }
  const payload = parsed.data;

  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return jsonError("unauthorized", "Sign in to continue", { status: 401 });
  }

  const tokens = await getUserTokens(userId);
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    logger.warn({ userId }, "[bulk/add] no tokens");
    return jsonError(
      "no_tokens",
      "YouTube authorization missing or expired. Please sign in again.",
      { status: 400 }
    );
  }

  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    payload.idempotencyKey ??
    undefined;

  // ✅ Idempotent hit：從 action log 重建 created[]
  if (idempotencyKey && (await checkIdempotencyKey(idempotencyKey))) {
    const summary = await getActionSummary(idempotencyKey);
    if (summary && summary.action.userId === userId) {
      const created = buildCreated(summary.items);
      const estimatedQuota = created.length * 50; // delete 時也用 50，一致就好

      return jsonOk({
        ...summary,
        created,
        estimatedQuota,
        idempotent: true,
      });
    }
  }

  // ✅ 實際執行 bulk add（有交易）
  const result = await withTransaction(async (client) => {
    const normalized = {
      targetPlaylistId: payload.targetPlaylistId,
      items: (payload.videoIds ?? []).map((v) => ({ videoId: v })),
    } as any;

    return performBulkAdd(normalized, {
      userId,
      actionId: idempotencyKey,
      pgClient: client,
    } as any);
  });

  if (idempotencyKey) await registerIdempotencyKey(idempotencyKey);

  const created = buildCreated(result.items);

  return jsonOk({
    ...result,
    created, // 👈 給前端 Undo / lastOp 用
    idempotent: false,
  });
}
