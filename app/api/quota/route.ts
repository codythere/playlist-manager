// /app/api/quota/route.ts
import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getTodayQuota } from "@/lib/quota";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const jar = await cookies();
    const raw = jar.get("ytpm_session")?.value;
    const userId = raw
      ? (JSON.parse(raw).userId as string | undefined)
      : undefined;

    if (!userId) {
      // 未登入：仍回 budget，used = 0（方便前端顯示 UI）
      const { budget, resetAtISO } = getTodayQuota("guest");
      return NextResponse.json({
        ok: true,
        data: {
          todayUsed: 0,
          todayRemaining: budget,
          todayBudget: budget,
          resetAtISO,
        },
      });
    }

    const q = getTodayQuota(userId);
    return NextResponse.json({
      ok: true,
      data: {
        todayUsed: q.used,
        todayRemaining: q.remain,
        todayBudget: q.budget,
        resetAtISO: q.resetAtISO,
      },
    });
  } catch (e: any) {
    return NextResponse.json(
      {
        ok: false,
        error: { code: "internal_error", message: e?.message ?? "failed" },
      },
      { status: 500 }
    );
  }
}
