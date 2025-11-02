// /app/api/bulk/remove/route.ts
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { jsonError, jsonOk } from "@/lib/result";
import { bulkRemoveSchema } from "@/validators/bulk";
import { performBulkRemove, getActionSummary } from "@/lib/actions-service";
import { checkIdempotencyKey, registerIdempotencyKey } from "@/lib/idempotency";
import { requireUserId } from "@/lib/auth";
import { getUserTokens } from "@/lib/google";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

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
  const hdr = req.headers.get("x-user-id");
  if (hdr) return hdr;
  return null;
}

export async function POST(request: NextRequest) {
  // 1) 讀 body
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("invalid_request", "Invalid JSON body", { status: 400 });
  }

  const parsed = bulkRemoveSchema.safeParse(body);
  if (!parsed.success) {
    return jsonError("invalid_request", parsed.error.message, { status: 400 });
  }
  const payload = parsed.data;

  // 2) 解析 userId
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return jsonError("unauthorized", "Sign in to continue", { status: 401 });
  }

  // 3) 確認 token 存在
  const tokens = await getUserTokens(userId);
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    logger.warn({ userId }, "[bulk/remove] no tokens");
    return jsonError(
      "no_tokens",
      "YouTube authorization missing or expired. Please sign in",
      { status: 400 }
    );
  }

  // 4) 冪等鍵
  const idemKey =
    request.headers.get("idempotency-key") ??
    payload.idempotencyKey ??
    undefined;

  if (idemKey && checkIdempotencyKey(idemKey)) {
    const summary = getActionSummary(idemKey);
    if (summary && summary.action.userId === userId) {
      return jsonOk({
        ...summary,
        // 顯示用估算（delete 50/部）
        estimatedQuota: payload.playlistItemIds.length * 50,
        idempotent: true,
      });
    }
  }

  // 5) 執行（精準配額由 performBulkRemove 內部以 withQuota 記錄）
  const result = await performBulkRemove(payload, {
    userId,
    actionId: idemKey,
  });

  if (idemKey) registerIdempotencyKey(idemKey);

  return jsonOk({ ...result, idempotent: false });
}
