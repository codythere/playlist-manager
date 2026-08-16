// app/action-log/ActionLogClient.tsx
"use client";

import * as React from "react";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { Button } from "@/app/components/ui/button";
import { useToast } from "@/app/components/ui/use-toast";
import {
  ChevronDown,
  ChevronRight,
  RefreshCw,
  Undo2,
  List,
  Clock,
  CheckCircle2,
  XCircle,
  Info,
  Copy,
  Calendar,
} from "lucide-react";
import type {
  ActionCounts,
  ActionItemRecord,
  ActionRecord,
} from "@/types/actions";
import { DropdownSelect } from "@/app/components/ui/dropdown-select";
import { useRouter } from "next/navigation"; // ✅ 新增：用於輕量刷新

/* =============================
 * Types
 * ============================= */
interface ActionsResponse {
  actions: Array<{
    action: ActionRecord;
    counts: ActionCounts;
  }>;
  nextCursor: string | null;
}

interface ActionSummaryResponse {
  action: ActionRecord;
  counts: ActionCounts;
}

/** 後端富集：每個 item 可能帶 meta（標題/歌單名） */
type EnrichedMeta =
  | {
      videoTitle: string | null;
      sourcePlaylistName: string | null;
      targetPlaylistName: string | null;
    }
  | null
  | undefined;

type EnrichedActionItem = ActionItemRecord & { meta?: EnrichedMeta };

/** 分頁載入 Action Items（已富集，但允許為空，前端會補缺） */
interface ActionItemsPageResponse {
  items: EnrichedActionItem[];
  nextCursor: string | null;
  total?: number;
}

interface ApiError extends Error {
  code?: string;
  status?: number;
}

/* =============================
 * Defaults
 * ============================= */
const DEFAULT_PAGE_SIZE = 10;
const DEFAULT_ITEM_PAGE_SIZE = 20;

/* =============================
 * Utils
 * ============================= */
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function extractApiError(payload: unknown) {
  if (!isRecord(payload)) return null;
  if (payload.ok === false && isRecord(payload.error)) {
    const errorRecord = payload.error as Record<string, unknown>;
    return {
      code: typeof errorRecord.code === "string" ? errorRecord.code : undefined,
      message:
        typeof errorRecord.message === "string"
          ? errorRecord.message
          : undefined,
    };
  }
  return null;
}

function extractApiData<T>(payload: unknown): T | undefined {
  if (!isRecord(payload)) return undefined;
  if (payload.ok === true && "data" in payload) {
    return payload.data as T;
  }
  return undefined;
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  let payload: unknown;
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    payload = await response.json().catch(() => null);
  } else if (!response.ok) {
    const text = await response.text();
    throw new Error(text || response.statusText || "Request failed");
  } else {
    payload = null;
  }

  const apiError = extractApiError(payload);
  if (!response.ok || apiError) {
    const message =
      apiError?.message ?? response.statusText ?? "Request failed";
    const error = new Error(message) as ApiError;
    (error as ApiError).code = apiError?.code;
    (error as ApiError).status = response.status;
    throw error;
  }

  const data = extractApiData<T>(payload);
  if (data !== undefined) return data;
  return payload as T;
}

function formatTimestamp(value: string | null) {
  if (!value) return "-";
  let v = value;
  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(v)) {
    v = v.replace(" ", "T") + "Z";
  }
  const date = new Date(v);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("zh-TW", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    timeZone: "Asia/Taipei",
  }).format(date);
}

function cn(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(" ");
}

function uniq<T>(arr: T[]) {
  return Array.from(new Set(arr.filter(Boolean)));
}

/* =============================
 * 後端優先 + 前端補缺 的解析 hooks
 * 只對「沒有 meta 名稱/標題」的 id 發請求
 * ============================= */
async function fetchPlaylistNames(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, string>;
  const qs = new URLSearchParams({ ids: ids.join(",") }).toString();
  const data = await apiRequest<{ names: Record<string, string> }>(
    `/api/youtube/meta/playlists?${qs}`,
  );
  return data.names ?? {};
}

async function fetchVideoTitles(ids: string[]) {
  if (ids.length === 0) return {} as Record<string, string>;
  const qs = new URLSearchParams({ ids: ids.join(",") }).toString();
  const data = await apiRequest<{ titles: Record<string, string> }>(
    `/api/youtube/meta/videos?${qs}`,
  );
  return data.titles ?? {};
}

/** 從「已載入的 items」收集還缺的 playlist 名稱 id */
function collectMissingPlaylistIds(
  actions: Array<{ action: ActionRecord }>,
  itemsByAction: Record<string, EnrichedActionItem[]>,
) {
  const need: string[] = [];

  // 先把 action 標頭可能會用到的 id 收集進來（沒有 meta）
  for (const { action } of actions) {
    if (action.sourcePlaylistId) need.push(action.sourcePlaylistId);
    if (action.targetPlaylistId) need.push(action.targetPlaylistId);
  }

  // 再看每個 item，若 meta 沒名稱就補
  for (const list of Object.values(itemsByAction)) {
    for (const it of list) {
      if (it.sourcePlaylistId && !it.meta?.sourcePlaylistName) {
        need.push(it.sourcePlaylistId);
      }
      if (it.targetPlaylistId && !it.meta?.targetPlaylistName) {
        need.push(it.targetPlaylistId);
      }
    }
  }
  return uniq(need);
}

/** 從「已載入的 items」收集還缺的 video 標題 id */
function collectMissingVideoIds(
  itemsByAction: Record<string, EnrichedActionItem[]>,
) {
  const need: string[] = [];
  for (const list of Object.values(itemsByAction)) {
    for (const it of list) {
      if (it.videoId && !it.meta?.videoTitle) {
        need.push(it.videoId);
      }
    }
  }
  return uniq(need);
}

function usePlaylistNameResolver(
  actions: Array<{ action: ActionRecord }>,
  itemsByAction: Record<string, EnrichedActionItem[]>,
  depVersion: number,
) {
  const ids = collectMissingPlaylistIds(actions, itemsByAction);
  const query = useQuery({
    queryKey: ["playlist-names-missing", depVersion, ids.sort().join(",")],
    queryFn: () => fetchPlaylistNames(ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  return query.data ?? ({} as Record<string, string>);
}

function useVideoTitleResolver(
  itemsByAction: Record<string, EnrichedActionItem[]>,
  depVersion: number,
) {
  const ids = collectMissingVideoIds(itemsByAction);
  const query = useQuery({
    queryKey: ["video-titles-missing", depVersion, ids.sort().join(",")],
    queryFn: () => fetchVideoTitles(ids),
    enabled: ids.length > 0,
    staleTime: 10 * 60 * 1000,
  });
  return query.data ?? ({} as Record<string, string>);
}

/* =============================
 * 小型 UI
 * ============================= */
function Badge({
  color,
  children,
  title,
}: {
  color: "green" | "yellow" | "red" | "slate" | "blue";
  children: React.ReactNode;
  title?: string;
}) {
  const map: Record<typeof color, string> = {
    green:
      "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50",
    yellow:
      "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/50",
    red: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200/50",
    slate:
      "bg-slate-100/70 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 border border-slate-200/50",
    blue: "bg-blue-100/70 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border border-blue-200/50",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-sm",
        map[color],
      )}
      title={title}
    >
      {children}
    </span>
  );
}

function StatusBadge({ status }: { status: ActionRecord["status"] }) {
  if (status === "success")
    return (
      <Badge color="green" title="Success">
        <CheckCircle2 className="h-3.5 w-3.5" />
        SUCCESS
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge color="red" title="Failed">
        <XCircle className="h-3.5 w-3.5" />
        FAILED
      </Badge>
    );
  if (status === "running")
    return (
      <Badge color="yellow" title="Running">
        <Clock className="h-3.5 w-3.5" />
        RUNNING
      </Badge>
    );
  return (
    <Badge color="slate" title={status}>
      {status.toUpperCase()}
    </Badge>
  );
}

type BadgeColor = "green" | "yellow" | "red" | "slate" | "blue";

function TypeBadge({ type }: { type: ActionRecord["type"] }) {
  const t = String(type).toLowerCase();
  const color: BadgeColor =
    t === "add" ? "blue" : t === "move" ? "yellow" : "slate";
  const label = typeof type === "string" ? type.toUpperCase() : String(type);
  return <Badge color={color}>{label}</Badge>;
}

function CopyButton({ text, className }: { text: string; className?: string }) {
  const { toast } = useToast();
  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          toast({ title: "Copied", duration: 1200 });
        } catch {
          toast({ title: "Copy failed", duration: 1500 });
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted",
        className,
      )}
      title="Copy"
    >
      <Copy className="h-3.5 w-3.5" />
      Copy
    </button>
  );
}

function SectionTitle({
  icon: Icon,
  title,
  right,
}: {
  icon: React.ComponentType<any>;
  title: string;
  right?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex items-center gap-2.5">
        {/* Simplified icon container */}
        <div className="flex items-center justify-center w-9 h-9 rounded-sm bg-gradient-to-br from-violet-500 to-purple-600 text-white shadow-md">
          <Icon className="h-5 w-5" />
        </div>

        {/* Clean title */}
        <h1 className="text-xl md:text-2xl font-semibold text-foreground">
          {title}
        </h1>
      </div>
      {right}
    </div>
  );
}

function CardShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200/50 bg-white/60 backdrop-blur-sm shadow-[0_4px_12px_-4px_rgba(15,23,42,0.1)] transition-all duration-200 hover:shadow-[0_8px_20px_-6px_rgba(15,23,42,0.15)] hover:border-slate-200/70">
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse border-b px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="mt-2 h-3 w-64 rounded bg-muted" />
    </div>
  );
}

/* =============================
 * Component: ActionLogClient
 * ============================= */
export default function ActionLogClient() {
  const router = useRouter(); // ✅ 新增：取得 router
  const queryClient = useQueryClient();
  const [pageSize, setPageSize] = React.useState<number>(DEFAULT_PAGE_SIZE);

  const actionsQuery = useInfiniteQuery({
    queryKey: ["actions", { limit: pageSize }],
    queryFn: ({ pageParam }) =>
      apiRequest<ActionsResponse>(
        `/api/actions?limit=${pageSize}${
          pageParam ? `&cursor=${pageParam}` : ""
        }`,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    initialPageParam: undefined as string | undefined,
  });

  const actions = React.useMemo(() => {
    if (!actionsQuery.data) return [] as ActionsResponse["actions"];
    return actionsQuery.data.pages.flatMap((page) => page.actions);
  }, [actionsQuery.data]);

  // 收集各 action 已載入的 items
  const itemsByActionRef = React.useRef<Record<string, EnrichedActionItem[]>>(
    {},
  );
  const [itemsVersion, setItemsVersion] = React.useState(0);
  const onItemsLoaded = React.useCallback(
    (actionId: string, items: EnrichedActionItem[]) => {
      itemsByActionRef.current[actionId] = items;
      setItemsVersion((v) => v + 1); // 讓補缺 hooks 更新
    },
    [],
  );

  // 只補「後端沒提供」的名稱/標題
  const playlistNames = usePlaylistNameResolver(
    actions,
    itemsByActionRef.current,
    itemsVersion,
  );
  const videoTitles = useVideoTitleResolver(
    itemsByActionRef.current,
    itemsVersion,
  );

  // 自動載入更多
  const loadMoreRef = React.useRef<HTMLDivElement | null>(null);
  React.useEffect(() => {
    if (!actionsQuery.hasNextPage || actionsQuery.isFetchingNextPage) return;
    const node = loadMoreRef.current;
    if (!node) return;

    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (e.isIntersecting) {
          actionsQuery.fetchNextPage();
          break;
        }
      }
    });
    io.observe(node);
    return () => io.disconnect();
  }, [
    actionsQuery.hasNextPage,
    actionsQuery.isFetchingNextPage,
    actionsQuery.fetchNextPage,
  ]);

  if (actionsQuery.isLoading) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-100/40 to-purple-100/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl p-6">
          <SectionTitle icon={List} title="Action Log" />
          <div className="mt-8 space-y-3">
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </div>
        </div>
      </div>
    );
  }

  if (actionsQuery.isError) {
    const error = actionsQuery.error as ApiError;
    if (error.code === "unauthorized") {
      return (
        <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 flex items-center justify-center">
          <div className="relative z-10 text-center">
            <div className="mb-4 text-5xl">🔐</div>
            <p className="text-lg text-muted-foreground font-medium">
              Sign in to view your recent actions.
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30 flex items-center justify-center">
        <div className="relative z-10 text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <p className="text-lg text-destructive font-medium">
            {error.message || "Failed to load actions"}
          </p>
        </div>
      </div>
    );
  }

  if (!actions.length) {
    return (
      <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30">
        {/* Decorative background */}
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-100/40 to-purple-100/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-6xl p-6">
          <SectionTitle icon={List} title="Action Log" />
          <div className="mt-8 flex items-center justify-center">
            <CardShell>
              <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
                <div className="text-5xl">📋</div>
                <p className="text-base font-medium text-foreground">
                  No actions recorded yet
                </p>
                <p className="text-sm text-muted-foreground">
                  Run a bulk add/move/remove to populate history.
                </p>
              </div>
            </CardShell>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-gradient-to-br from-white via-slate-50/50 to-slate-100/30">
      {/* Decorative background elements */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-violet-100/40 to-purple-100/20 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 left-1/2 w-80 h-80 bg-gradient-to-tr from-blue-100/30 to-violet-100/20 rounded-full blur-3xl pointer-events-none" />

      <div className="relative z-10 mx-auto max-w-6xl px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <SectionTitle
            icon={List}
            title="Action Log"
            right={
              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
                <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">
                    Pages: {actionsQuery.data?.pages.length ?? 1}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-slate-600">
                    Size
                  </span>
                  <DropdownSelect
                    aria-label="Page size"
                    value={String(pageSize)}
                    onValueChange={(val) => {
                      const next = Number(val);
                      setPageSize(next);
                      queryClient.invalidateQueries({ queryKey: ["actions"] });
                    }}
                    options={[10, 20, 30, 50].map((n) => ({
                      label: n,
                      value: String(n),
                    }))}
                    triggerWidth={100}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => window.location.reload()}
                  className="inline-flex items-center gap-2 rounded-lg"
                  title="Refresh data"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">Refresh</span>
                </Button>
              </div>
            }
          />
        </div>

        {/* List */}
        <div className="space-y-3">
          {actions.map(({ action, counts }) => (
            <ActionCard
              key={action.id}
              action={action}
              counts={counts}
              onRefetch={() => {
                queryClient.invalidateQueries({ queryKey: ["actions"] });
              }}
              playlistNames={playlistNames}
              videoTitles={videoTitles}
              onItemsLoaded={onItemsLoaded}
              getLoadedItems={() => itemsByActionRef.current[action.id] ?? []}
            />
          ))}
        </div>

        {/* Footer Load More */}
        {actionsQuery.hasNextPage ? (
          <div className="mt-8 flex flex-col items-center gap-4">
            <div ref={loadMoreRef} />
            <Button
              variant="outline"
              onClick={() => actionsQuery.fetchNextPage()}
              disabled={actionsQuery.isFetchingNextPage}
              className="rounded-lg px-6 py-2"
            >
              {actionsQuery.isFetchingNextPage ? (
                <span className="flex items-center gap-2">
                  <svg
                    className="w-4 h-4 animate-spin"
                    xmlns="http://www.w3.org/2000/svg"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    ></path>
                  </svg>
                  Loading...
                </span>
              ) : (
                "Load more"
              )}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/* =============================
 * Action Card
 * ============================= */
interface ActionCardProps {
  action: ActionRecord;
  counts: ActionCounts;
  onRefetch(): void;
  playlistNames: Record<string, string>; // 前端補缺地圖
  videoTitles: Record<string, string>; // 前端補缺地圖
  onItemsLoaded(actionId: string, items: EnrichedActionItem[]): void;
  getLoadedItems(): EnrichedActionItem[]; // 供標頭從 meta 推斷名稱
}

function ActionCard({
  action,
  counts,
  onRefetch,
  playlistNames,
  videoTitles, // 目前卡片標頭只用到歌單名，但先帶著
  onItemsLoaded,
  getLoadedItems,
}: ActionCardProps) {
  const [expanded, setExpanded] = React.useState(false);
  const toggle = React.useCallback(() => setExpanded((p) => !p), []);

  const icon = expanded ? (
    <ChevronDown className="h-4 w-4" />
  ) : (
    <ChevronRight className="h-4 w-4" />
  );

  // 從「已載入 items 的 meta」嘗試推斷標頭名稱；若沒有，再用補缺地圖；最後退回 ID
  const loaded = getLoadedItems();
  const sourceName =
    (action.sourcePlaylistId &&
      (loaded.find((i) => i.sourcePlaylistId === action.sourcePlaylistId)?.meta
        ?.sourcePlaylistName ||
        playlistNames[action.sourcePlaylistId])) ||
    action.sourcePlaylistId ||
    "-";

  const targetName =
    (action.targetPlaylistId &&
      (loaded.find((i) => i.targetPlaylistId === action.targetPlaylistId)?.meta
        ?.targetPlaylistName ||
        playlistNames[action.targetPlaylistId])) ||
    action.targetPlaylistId ||
    "-";

  return (
    <CardShell>
      <div className="px-5 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          {/* Left side - Info */}
          <div className="min-w-0 flex-1">
            {/* Badges and toggle */}
            <div className="flex flex-wrap items-center gap-2 mb-3">
              <TypeBadge type={action.type} />
              <StatusBadge status={action.status} />
              <button
                type="button"
                onClick={toggle}
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
                aria-expanded={expanded}
              >
                {icon}
                <span className="hidden sm:inline">
                  {expanded ? "Hide" : "Show"} items
                </span>
              </button>
            </div>

            {/* Timeline info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-400 flex-shrink-0" />
                <span>
                  Created{" "}
                  <span className="font-semibold">
                    {formatTimestamp(action.createdAt)}
                  </span>
                </span>
                <span className="opacity-40">•</span>
                <span>
                  Finished{" "}
                  <span className="font-semibold">
                    {formatTimestamp(action.finishedAt)}
                  </span>
                </span>
              </div>

              {/* Source and target */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-60">From:</span>
                  <span className="truncate font-medium text-slate-700">
                    {sourceName}
                  </span>
                </span>
                <span className="opacity-40">→</span>
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-60">To:</span>
                  <span className="truncate font-medium text-slate-700">
                    {targetName}
                  </span>
                </span>
              </div>

              {action.parentActionId ? (
                <div className="text-[10px] opacity-50 font-mono">
                  Parent: {action.parentActionId}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right side - Stats */}
          <div className="shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Badge color="green" title="Successful items">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {counts.success}
              </Badge>
              <Badge color="red" title="Failed items">
                <XCircle className="h-3.5 w-3.5" />
                {counts.failed}
              </Badge>
              <Badge color="slate" title="Total items">
                <List className="h-3.5 w-3.5" />
                {counts.total}
              </Badge>
            </div>
          </div>
        </div>

        <ActionDetails
          actionId={action.id}
          expanded={expanded}
          counts={counts}
          onRefetch={onRefetch}
          playlistNames={playlistNames}
          videoTitles={videoTitles}
          onItemsLoaded={onItemsLoaded}
        />
      </div>
    </CardShell>
  );
}

/* =============================
 * Action Details
 * ============================= */
interface ActionDetailsProps {
  actionId: string;
  expanded: boolean;
  counts: ActionCounts;
  onRefetch(): void;
  playlistNames: Record<string, string>;
  videoTitles: Record<string, string>;
  onItemsLoaded(actionId: string, items: EnrichedActionItem[]): void;
}

function ActionDetails({
  actionId,
  expanded,
  counts,
  onRefetch,
  playlistNames, // 目前表格顯示不直接用，但保留參數結構
  videoTitles,
  onItemsLoaded,
}: ActionDetailsProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [itemPageSize, setItemPageSize] = React.useState<number>(
    DEFAULT_ITEM_PAGE_SIZE,
  );

  const summaryQuery = useQuery({
    queryKey: ["action-summary", actionId],
    queryFn: () =>
      apiRequest<ActionSummaryResponse>(`/api/actions/${actionId}`),
    enabled: expanded,
  });

  // 分頁載入（後端富集；缺的由外層 hooks 補）
  const itemsQuery = useInfiniteQuery({
    queryKey: ["action-items", actionId, { limit: itemPageSize }],
    queryFn: ({ pageParam }) =>
      apiRequest<ActionItemsPageResponse>(
        `/api/actions/${actionId}/items?limit=${itemPageSize}${
          pageParam ? `&cursor=${pageParam}` : ""
        }`,
      ),
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: expanded,
    initialPageParam: undefined as string | undefined,
  });

  const items = React.useMemo(() => {
    if (!itemsQuery.data) return [] as EnrichedActionItem[];
    return itemsQuery.data.pages.flatMap((p) => p.items);
  }, [itemsQuery.data]);

  React.useEffect(() => {
    if (!expanded) return;
    if (!itemsQuery.data) return;
    const all = itemsQuery.data.pages.flatMap((p) => p.items);
    onItemsLoaded(actionId, all);
  }, [expanded, itemsQuery.data, actionId, onItemsLoaded]);

  const retryMutation = useMutation({
    mutationFn: () =>
      apiRequest<ActionSummaryResponse>(
        `/api/actions/${actionId}/retry-failed`,
        { method: "POST" },
      ),
    onSuccess: () => {
      toast({ title: "Retry scheduled", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["action-summary", actionId] });
      queryClient.invalidateQueries({ queryKey: ["action-items", actionId] });
      onRefetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "Unable to retry";
      toast({ title: "Retry failed", description: message, duration: 4000 });
    },
  });

  const undoMutation = useMutation({
    mutationFn: () =>
      apiRequest<ActionSummaryResponse>(`/api/actions/${actionId}/undo`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast({ title: "Undo scheduled", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["action-summary", actionId] });
      queryClient.invalidateQueries({ queryKey: ["action-items", actionId] });
      onRefetch();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "Unable to undo";
      toast({ title: "Undo failed", description: message, duration: 4000 });
    },
  });

  return (
    <div
      className={cn(
        "grid overflow-hidden transition-[grid-template-rows,opacity] duration-300",
        expanded ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
      )}
    >
      <div className="min-h-0">
        <div className="mt-4 space-y-4 rounded-lg border border-slate-200/30 bg-gradient-to-br from-slate-50/50 to-slate-100/30 backdrop-blur-sm p-4">
          {/* Action buttons row */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => retryMutation.mutate()}
              disabled={true}
              className="inline-flex items-center gap-2 rounded-lg"
            >
              <RefreshCw className="h-4 w-4" />
              Retry failed
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => undoMutation.mutate()}
              disabled={true}
              className="inline-flex items-center gap-2 rounded-lg"
            >
              <Undo2 className="h-4 w-4" />
              Undo
            </Button>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">
                Items per page
              </span>
              <DropdownSelect
                aria-label="Items per page"
                value={String(itemPageSize)}
                onValueChange={(val) => {
                  const next = Number(val);
                  setItemPageSize(next);
                  queryClient.invalidateQueries({
                    queryKey: ["action-items", actionId],
                  });
                }}
                options={[10, 20, 50, 100].map((n) => ({
                  label: n,
                  value: String(n),
                }))}
                triggerWidth={120}
              />
            </div>
          </div>

          {/* Summary loading state */}
          {summaryQuery.isLoading ? (
            <div className="text-xs text-muted-foreground py-2">
              Loading summary...
            </div>
          ) : summaryQuery.isError ? (
            <div className="text-xs text-destructive py-2">
              {(summaryQuery.error as Error).message ??
                "Failed to load action summary"}
            </div>
          ) : null}

          {/* Items table section */}
          {itemsQuery.isLoading ? (
            <div className="space-y-2">
              <div className="h-8 w-full animate-pulse rounded bg-muted/60" />
              <div className="h-8 w-full animate-pulse rounded bg-muted/60" />
              <div className="h-8 w-full animate-pulse rounded bg-muted/60" />
            </div>
          ) : itemsQuery.isError ? (
            <div className="text-xs text-destructive">
              {(itemsQuery.error as Error).message ??
                "Failed to load action items"}
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              No recorded items.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">Type</th>
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Source</th>
                    <th className="py-2 pr-3">Target</th>
                    <th className="py-2 pr-3">Video</th>
                    <th className="py-2">Error</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {items.map((it, idx) => {
                    const meta = it.meta;
                    const srcName =
                      meta?.sourcePlaylistName ??
                      (it.sourcePlaylistId
                        ? (playlistNames[it.sourcePlaylistId] ??
                          it.sourcePlaylistId)
                        : "-");

                    const tgtName =
                      meta?.targetPlaylistName ??
                      (it.targetPlaylistId
                        ? (playlistNames[it.targetPlaylistId] ??
                          it.targetPlaylistId)
                        : "-");

                    const title =
                      meta?.videoTitle ??
                      (it.videoId
                        ? (videoTitles[it.videoId] ?? it.videoId)
                        : "-");

                    return (
                      <tr
                        key={it.id}
                        className={cn(
                          "text-xs transition hover:bg-muted/40",
                          idx % 2 === 1 ? "bg-muted/20" : "",
                        )}
                      >
                        <td className="py-2 pr-3 font-medium">{it.type}</td>
                        <td className="py-2 pr-3">
                          {it.status === "success" ? (
                            <Badge color="green">SUCCESS</Badge>
                          ) : it.status === "failed" ? (
                            <Badge color="red">FAILED</Badge>
                          ) : (
                            <Badge color="yellow">
                              {it.status.toUpperCase()}
                            </Badge>
                          )}
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{srcName}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="truncate">{tgtName}</span>
                          </div>
                        </td>
                        <td className="py-2 pr-3">
                          <div className="flex items-center gap-1">
                            <span className="font-medium">{title}</span>
                            {it.videoId ? (
                              <CopyButton text={it.videoId} />
                            ) : null}
                          </div>
                        </td>
                        <td className="py-2 text-[11px]">
                          {it.errorCode ? (
                            <div className="flex items-center gap-1">
                              <span className="font-medium">
                                {it.errorCode}
                              </span>
                              :<span>{it.errorMessage ?? "-"}</span>
                            </div>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Items 分頁控制（不顯示 "No more items"） */}
              {itemsQuery.hasNextPage ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => itemsQuery.fetchNextPage()}
                    disabled={itemsQuery.isFetchingNextPage}
                    className="rounded-lg"
                  >
                    {itemsQuery.isFetchingNextPage
                      ? "Loading..."
                      : "Load more items"}
                  </Button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
