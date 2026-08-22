// /app/components/progress/OperationProgress.tsx
"use client";

import * as React from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Phase = "idle" | "running" | "success" | "error";

interface ActionProgress {
  id: string;
  type: "ADD" | "REMOVE" | "MOVE" | "UNDO";
  status: string;
  total: number;
  success: number;
  failed: number;
  inserted: number;
}

interface JobState {
  label: string;
  expectedTotal: number;
  /** 一次操作可能拆成多個請求（例如跨多個來源清單移轉），全部結束才算完成 */
  jobCount: number;
  settled: number;
  failedJobs: number;
  actionIds: string[];
}

export interface OperationProgressApi {
  /** 開始一次操作；expectedTotal 是前端已知的影片數，讓面板一出現就有分母 */
  start(opts: { label: string; expectedTotal: number; jobCount?: number }): void;
  /** 註冊要輪詢的 action id（等同送出的 idempotencyKey） */
  track(actionId: string | null | undefined): void;
  /** 單一請求結束；全部結束後面板才會收尾 */
  settle(ok: boolean): void;
}

const noop: OperationProgressApi = {
  start: () => {},
  track: () => {},
  settle: () => {},
};

const OperationProgressContext = React.createContext<OperationProgressApi>(noop);

export function useOperationProgress() {
  return React.useContext(OperationProgressContext);
}

const POLL_INTERVAL_MS = 700;
const HIDE_DELAY_MS = { success: 1800, error: 4000 };

export function OperationProgressProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [job, setJob] = React.useState<JobState | null>(null);
  const [actions, setActions] = React.useState<ActionProgress[]>([]);

  const api = React.useMemo<OperationProgressApi>(
    () => ({
      start: ({ label, expectedTotal, jobCount = 1 }) => {
        setActions([]);
        setJob({
          label,
          expectedTotal,
          jobCount: Math.max(1, jobCount),
          settled: 0,
          failedJobs: 0,
          actionIds: [],
        });
        setPhase("running");
      },

      track: (actionId) => {
        if (!actionId) return;
        setJob((prev) =>
          prev && !prev.actionIds.includes(actionId)
            ? { ...prev, actionIds: [...prev.actionIds, actionId] }
            : prev,
        );
      },

      settle: (ok) => {
        setJob((prev) => {
          if (!prev) return prev;
          const settled = prev.settled + 1;
          const failedJobs = prev.failedJobs + (ok ? 0 : 1);
          if (settled >= prev.jobCount) {
            setPhase(failedJobs > 0 ? "error" : "success");
          }
          return { ...prev, settled, failedJobs };
        });
      },
    }),
    [],
  );

  const actionIdsKey = job?.actionIds.join(",") ?? "";

  React.useEffect(() => {
    if (phase !== "running" || !actionIdsKey) return;

    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(
          `/api/actions/progress?ids=${encodeURIComponent(actionIdsKey)}`,
          { credentials: "include", cache: "no-store" },
        );
        if (!res.ok) return;
        const payload = await res.json();
        const next = payload?.data?.actions;
        if (!cancelled && Array.isArray(next)) setActions(next);
      } catch {
        // 輪詢失敗不影響實際操作，靜默重試即可
      }
    };

    poll();
    const timer = setInterval(poll, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [phase, actionIdsKey]);

  React.useEffect(() => {
    if (phase !== "success" && phase !== "error") return;
    const timer = setTimeout(() => {
      setPhase("idle");
      setJob(null);
      setActions([]);
    }, HIDE_DELAY_MS[phase]);
    return () => clearTimeout(timer);
  }, [phase]);

  const stats = React.useMemo(() => {
    let weightedDone = 0;
    let weightedTotal = 0;
    let done = 0;
    let total = 0;
    let failed = 0;
    let movingIn = false;

    for (const a of actions) {
      total += a.total;
      done += a.success + a.failed;
      failed += a.failed;

      if (a.type === "MOVE") {
        // MOVE 分兩階段：先全部插入目標，再逐筆刪除來源
        const phase1 = Math.min(a.total, a.inserted + a.failed);
        weightedDone += phase1 + a.success + a.failed;
        weightedTotal += a.total * 2;
        if (a.status === "running" && a.success === 0 && a.total > 0) {
          movingIn = true;
        }
      } else {
        weightedDone += a.success + a.failed;
        weightedTotal += a.total;
      }
    }

    return { weightedDone, weightedTotal, done, total, failed, movingIn };
  }, [actions]);

  if (phase === "idle" || !job) {
    return (
      <OperationProgressContext.Provider value={api}>
        {children}
      </OperationProgressContext.Provider>
    );
  }

  const finished = phase === "success" || phase === "error";
  const displayTotal = Math.max(job.expectedTotal, stats.total);
  const displayDone = finished ? displayTotal : stats.done;
  const indeterminate = !finished && stats.weightedTotal === 0;
  const percent = finished
    ? 100
    : stats.weightedTotal > 0
      ? Math.min(99, Math.round((stats.weightedDone / stats.weightedTotal) * 100))
      : 0;

  const hint = finished
    ? phase === "success"
      ? stats.failed > 0
        ? `${stats.failed} 部影片失敗，可至操作紀錄查看`
        : "全部完成"
      : "操作失敗，可至操作紀錄查看詳細錯誤"
    : indeterminate
      ? "正在與 YouTube 建立連線…"
      : stats.movingIn
        ? "正在加入目標清單…"
        : "正在與 YouTube 逐筆同步…";

  return (
    <OperationProgressContext.Provider value={api}>
      {children}

      {/* 頂端細進度條：不擋點擊，只負責讓進度隨時可見 */}
      <div className="pointer-events-none fixed inset-x-0 top-0 z-[70] h-1 overflow-hidden bg-primary/10">
        {indeterminate ? (
          <div className="h-full w-1/3 animate-progress-slide rounded-full bg-primary" />
        ) : (
          <div
            className={cn(
              "h-full rounded-r-full transition-[width] duration-500 ease-out",
              phase === "error" ? "bg-destructive" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        )}
      </div>

      {/* 浮動面板：置於 header 下方置中，比按鈕內的小轉圈明顯許多 */}
      <div
        className="pointer-events-none fixed left-1/2 top-20 z-[70] w-[min(92vw,380px)] -translate-x-1/2"
        role="status"
        aria-live="polite"
      >
        <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-[0_24px_48px_-20px_rgba(15,15,20,0.45)] backdrop-blur-xl">
          <div className="flex items-center gap-3">
            {phase === "success" ? (
              <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-500" />
            ) : phase === "error" ? (
              <XCircle className="h-5 w-5 shrink-0 text-destructive" />
            ) : (
              <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
            )}

            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold text-foreground">
                {job.label}
                {finished ? "" : "中…"}
              </div>
              <div className="truncate text-xs text-muted-foreground">
                {hint}
              </div>
            </div>

            <div className="shrink-0 text-right">
              <div className="text-lg font-bold tabular-nums text-foreground">
                {percent}%
              </div>
              {displayTotal > 0 ? (
                <div className="text-[11px] tabular-nums text-muted-foreground">
                  {displayDone} / {displayTotal} 部
                </div>
              ) : null}
            </div>
          </div>

          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={indeterminate ? undefined : percent}
            aria-label={job.label}
          >
            {indeterminate ? (
              <div className="h-full w-1/3 animate-progress-slide rounded-full bg-primary" />
            ) : (
              <div
                className={cn(
                  "h-full rounded-full transition-[width] duration-500 ease-out",
                  phase === "error" ? "bg-destructive" : "bg-primary",
                )}
                style={{ width: `${percent}%` }}
              />
            )}
          </div>

          {stats.failed > 0 && !finished ? (
            <div className="mt-2 text-[11px] font-medium text-destructive">
              已有 {stats.failed} 部失敗
            </div>
          ) : null}
        </div>
      </div>
    </OperationProgressContext.Provider>
  );
}
