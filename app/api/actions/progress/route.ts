import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/result";
import { requireUserId } from "@/lib/auth";
import { getActionsProgress } from "@/lib/actions-store";

export const dynamic = "force-dynamic";

const MAX_IDS = 50;

export async function GET(req: NextRequest) {
  try {
    const auth = await requireUserId(req);
    if (!auth) {
      return jsonError("unauthorized", "Sign in required", { status: 401 });
    }

    const ids = (req.nextUrl.searchParams.get("ids") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .slice(0, MAX_IDS);

    if (ids.length === 0) return jsonOk({ actions: [] });

    const actions = await getActionsProgress(ids, auth.userId);
    return jsonOk({ actions });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Internal error";
    return jsonError("internal_error", msg, { status: 500 });
  }
}
