// app/api/bulk/add/route.ts
import type { NextRequest } from "next/server";
import { cookies } from "next/headers";
import { jsonError, jsonOk } from "@/lib/result";
import { bulkAddSchema } from "@/validators/bulk";
import { performBulkAdd, getActionSummary } from "@/lib/actions-service";
import { checkIdempotencyKey, registerIdempotencyKey } from "@/lib/idempotency";
import { requireUserId } from "@/lib/auth";
import { getUserTokens } from "@/lib/google";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

// 與 move/remove 共用的 userId 解析
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
  // 1) 讀取並驗證 body
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

  // 2) 解析 userId
  const userId = await getUserIdFromRequest(request);
  if (!userId) {
    return jsonError("unauthorized", "Sign in to continue", { status: 401 });
  }

  // 3) 先檢查 DB 內是否真的有 token
  const tokens = await getUserTokens(userId);
  if (!tokens || (!tokens.access_token && !tokens.refresh_token)) {
    logger.warn({ userId }, "[bulk/add] no tokens");
    return jsonError(
      "no_tokens",
      "YouTube authorization missing or expired. Please sign in again.",
      { status: 400 }
    );
  }

  // 4) 冪等鍵
  const idempotencyKey =
    request.headers.get("idempotency-key") ??
    payload.idempotencyKey ??
    undefined;

  if (idempotencyKey && checkIdempotencyKey(idempotencyKey)) {
    const summary = getActionSummary(idempotencyKey);
    if (summary && summary.action.userId === userId) {
      // 回傳快取的 summary + 估算配額（僅顯示用）
      return jsonOk({
        ...summary,
        estimatedQuota: payload.videoIds.length * 50,
        idempotent: true,
      });
    }
  }

  // 5) 執行（精準配額由 performBulkAdd 內部以 withQuota 記錄）
  const result = await performBulkAdd(payload, {
    userId,
    actionId: idempotencyKey,
  });

  if (idempotencyKey) {
    registerIdempotencyKey(idempotencyKey);
  }

  return jsonOk({
    ...result,
    idempotent: false,
  });
}
