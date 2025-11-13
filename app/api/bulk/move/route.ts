import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/result";
import { bulkMoveSchema } from "@/validators/bulk";
import { performBulkMove, getActionSummary } from "@/lib/actions-service";
import { checkIdempotencyKey, registerIdempotencyKey } from "@/lib/idempotency";
import { requireUserId } from "@/lib/auth";
import { getYouTubeClientEx } from "@/lib/google";
import { withTransaction } from "@/lib/db";
import type { ActionItemRecord } from "@/types/actions";

export const dynamic = "force-dynamic";

type MovedItem = {
  from?: { playlistItemId?: string | null } | null;
  to?: { playlistItemId?: string | null } | null;
  videoId?: string | null;
};

function buildMoved(items: ActionItemRecord[] | undefined | null): MovedItem[] {
  if (!items) return [];
  return items
    .filter(
      (it) =>
        it.type === "MOVE" &&
        it.status === "success" &&
        !!it.sourcePlaylistItemId &&
        !!it.targetPlaylistItemId
    )
    .map((it) => ({
      from: { playlistItemId: it.sourcePlaylistItemId },
      to: { playlistItemId: it.targetPlaylistItemId },
      videoId: it.videoId,
    }));
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_request", "Invalid JSON body", { status: 400 });
  }

  const parsed = bulkMoveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", parsed.error.message, { status: 400 });
  }
  const payload = parsed.data;

  const auth = await requireUserId(request);
  if (!auth?.userId) {
    return jsonError("unauthorized", "Sign in to continue", { status: 401 });
  }
  const userId = auth.userId;

  // 確認真的有 YouTube client（這支原本就有這段檢查）
  try {
    const { yt, mock } = await getYouTubeClientEx({
      userId,
      requireReal: true,
    });
    if (!yt || mock) {
      return jsonError(
        "no_tokens",
        "YouTube authorization missing or expired. Please sign in again.",
        { status: 400 }
      );
    }
  } catch (err: any) {
    const code = err?.code === "NO_TOKENS" ? "no_tokens" : "unknown";
    return jsonError(
      code,
      "YouTube authorization missing or expired. Please sign in again.",
      { status: 400 }
    );
  }

  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    payload.idempotencyKey ??
    undefined;

  // ✅ Idempotent hit：從 action log 重建 moved[]
  if (idempotencyKey && (await checkIdempotencyKey(idempotencyKey))) {
    const summary = await getActionSummary(idempotencyKey);
    if (summary && summary.action.userId === userId) {
      const moved = buildMoved(summary.items);
      const estimatedQuota = moved.length * 100; // insert + delete

      return jsonOk({
        ...summary,
        moved,
        estimatedQuota,
        idempotent: true,
      });
    }
  }

  // ✅ 實際執行 bulk move（有交易）
  const result = await withTransaction(async (client) => {
    return performBulkMove(payload, {
      userId,
      actionId: idempotencyKey,
      pgClient: client,
    } as any);
  });

  if (idempotencyKey) await registerIdempotencyKey(idempotencyKey);

  const moved = buildMoved(result.items);

  return jsonOk({
    ...result,
    moved, // 👈 給 HomeClient 裡 MoveApiResult 使用
    idempotent: false,
  });
}
