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
  Loader2,
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
      "bg-emerald-100/70 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border border-emerald-200/50 dark:border-emerald-500/25",
    yellow:
      "bg-amber-100/70 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-200/50 dark:border-amber-500/25",
    red: "bg-rose-100/70 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border border-rose-200/50 dark:border-rose-500/25",
    slate:
      "bg-muted text-muted-foreground border border-border",
    blue: "bg-primary/10 text-primary border border-primary/20",
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
      <Badge color="green" title="成功">
        <CheckCircle2 className="h-3.5 w-3.5" />
        成功
      </Badge>
    );
  if (status === "failed")
    return (
      <Badge color="red" title="失敗">
        <XCircle className="h-3.5 w-3.5" />
        失敗
      </Badge>
    );
  if (status === "running")
    return (
      <Badge color="yellow" title="進行中">
        <Clock className="h-3.5 w-3.5" />
        進行中
      </Badge>
    );
  return (
    <Badge color="slate" title={status}>
      {status === "partial" ? "部分成功" : status === "pending" ? "等待中" : status}
    </Badge>
  );
}

type BadgeColor = "green" | "yellow" | "red" | "slate" | "blue";

function TypeBadge({ type }: { type: ActionRecord["type"] }) {
  const t = String(type).toLowerCase();
  const color: BadgeColor =
    t === "add" ? "blue" : t === "move" ? "yellow" : "slate";
  const label =
    t === "add"
      ? "新增"
      : t === "remove"
        ? "移除"
        : t === "move"
          ? "移轉"
          : t === "undo"
            ? "復原"
            : String(type);
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
          toast({ title: "已複製", duration: 1200 });
        } catch {
          toast({ title: "複製失敗", duration: 1500 });
        }
      }}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-muted",
        className,
      )}
      title="複製"
    >
      <Copy className="h-3.5 w-3.5" />
      複製
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
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
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
    <div className="rounded-2xl border border-border bg-card transition-colors hover:border-primary/30">
      {children}
    </div>
  );
}

function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-2xl border border-border bg-card px-5 py-4">
      <div className="flex items-center justify-between">
        <div className="h-3 w-40 rounded bg-muted" />
        <div className="h-3 w-24 rounded bg-muted" />
      </div>
      <div className="mt-3 h-3 w-64 rounded bg-muted" />
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
      <div className="page-wrap">
        <SectionTitle icon={List} title="操作紀錄" />
        <div className="space-y-3">
          <SkeletonRow />
          <SkeletonRow />
          <SkeletonRow />
        </div>
      </div>
    );
  }

  if (actionsQuery.isError) {
    const error = actionsQuery.error as ApiError;
    if (error.code === "unauthorized") {
      return (
        <div className="page-wrap flex min-h-[40vh] items-center justify-center">
          <div className="text-center">
            <div className="mb-4 text-5xl">🔐</div>
            <p className="text-lg text-muted-foreground font-medium">
              請登入後查看近期操作紀錄。
            </p>
          </div>
        </div>
      );
    }
    return (
      <div className="page-wrap flex min-h-[40vh] items-center justify-center">
        <div className="text-center">
          <div className="mb-4 text-5xl">⚠️</div>
          <p className="text-lg text-destructive font-medium">
            {error.message || "無法載入操作紀錄"}
          </p>
        </div>
      </div>
    );
  }

  if (!actions.length) {
    return (
      <div className="page-wrap">
        <SectionTitle icon={List} title="操作紀錄" />
        <div className="flex items-center justify-center">
          <CardShell>
            <div className="flex flex-col items-center gap-3 px-8 py-12 text-center">
              <div className="text-5xl">📋</div>
              <p className="text-base font-medium text-foreground">
                尚無操作紀錄
              </p>
              <p className="text-sm text-muted-foreground">
                執行批次新增／移轉／移除後，紀錄會顯示在這裡。
              </p>
            </div>
          </CardShell>
        </div>
      </div>
    );
  }

  return (
    <div className="page-wrap">
        {/* Header */}
        <div className="mb-8">
          <SectionTitle
            icon={List}
            title="操作紀錄"
            right={
              <div className="flex flex-wrap items-center gap-4 md:gap-6 text-sm">
                <div className="hidden items-center gap-2 text-muted-foreground sm:flex">
                  <Clock className="h-5 w-5" />
                  <span className="font-medium">
                    頁數：{actionsQuery.data?.pages.length ?? 1}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">
                    每頁筆數
                  </span>
                  <DropdownSelect
                    aria-label="每頁筆數"
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
                  title="重新整理"
                >
                  <RefreshCw className="h-4 w-4" />
                  <span className="hidden sm:inline">重新整理</span>
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
              aria-label="載入更多"
            >
              {actionsQuery.isFetchingNextPage ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "載入更多"
              )}
            </Button>
          </div>
        ) : null}
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
                className="inline-flex items-center gap-1.5 rounded-lg px-3 py-1 text-xs font-semibold text-primary transition-colors hover:bg-primary/10"
                aria-expanded={expanded}
              >
                {icon}
                <span className="hidden sm:inline">
                  {expanded ? "收合項目" : "顯示項目"}
                </span>
              </button>
            </div>

            {/* Timeline info */}
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 flex-shrink-0 text-muted-foreground" />
                <span>
                  建立於{" "}
                  <span className="font-semibold">
                    {formatTimestamp(action.createdAt)}
                  </span>
                </span>
                <span className="opacity-40">•</span>
                <span>
                  完成於{" "}
                  <span className="font-semibold">
                    {formatTimestamp(action.finishedAt)}
                  </span>
                </span>
              </div>

              {/* Source and target */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-60">來源：</span>
                  <span className="truncate font-medium text-foreground">
                    {sourceName}
                  </span>
                </span>
                <span className="opacity-40">→</span>
                <span className="inline-flex items-center gap-1">
                  <span className="opacity-60">目標：</span>
                  <span className="truncate font-medium text-foreground">
                    {targetName}
                  </span>
                </span>
              </div>

              {action.parentActionId ? (
                <div className="text-[10px] opacity-50 font-mono">
                  上層操作：{action.parentActionId}
                </div>
              ) : null}
            </div>
          </div>

          {/* Right side - Stats */}
          <div className="shrink-0 flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-xs">
              <Badge color="green" title="成功項目">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {counts.success}
              </Badge>
              <Badge color="red" title="失敗項目">
                <XCircle className="h-3.5 w-3.5" />
                {counts.failed}
              </Badge>
              <Badge color="slate" title="項目總數">
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
      toast({ title: "已排程重試", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["action-summary", actionId] });
      queryClient.invalidateQueries({ queryKey: ["action-items", actionId] });
      onRefetch();
    },
    onError: (error: unknown) => {
      const message =
        error instanceof Error ? error.message : "無法重試";
      toast({ title: "重試失敗", description: message, duration: 4000 });
    },
  });

  const undoMutation = useMutation({
    mutationFn: () =>
      apiRequest<ActionSummaryResponse>(`/api/actions/${actionId}/undo`, {
        method: "POST",
      }),
    onSuccess: () => {
      toast({ title: "已排程復原", duration: 3000 });
      queryClient.invalidateQueries({ queryKey: ["actions"] });
      queryClient.invalidateQueries({ queryKey: ["action-summary", actionId] });
      queryClient.invalidateQueries({ queryKey: ["action-items", actionId] });
      onRefetch();
    },
    onError: (error: unknown) => {
      const message = error instanceof Error ? error.message : "無法復原";
      toast({ title: "復原失敗", description: message, duration: 4000 });
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
        <div className="mt-4 space-y-4 rounded-xl border border-border bg-muted/40 p-4">
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
              重試失敗項目
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => undoMutation.mutate()}
              disabled={true}
              className="inline-flex items-center gap-2 rounded-lg"
            >
              <Undo2 className="h-4 w-4" />
              復原
            </Button>

            <div className="ml-auto flex items-center gap-2 text-xs">
              <span className="text-muted-foreground font-medium">
                每頁項目數
              </span>
              <DropdownSelect
                aria-label="每頁項目數"
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
            <div className="flex items-center py-2" role="status" aria-label="載入摘要中">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : summaryQuery.isError ? (
            <div className="text-xs text-destructive py-2">
              {(summaryQuery.error as Error).message ??
                "無法載入操作摘要"}
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
                "無法載入操作項目"}
            </div>
          ) : items.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              沒有記錄的項目。
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
                  <tr className="text-left text-[12px] uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-3">類型</th>
                    <th className="py-2 pr-3">狀態</th>
                    <th className="py-2 pr-3">來源</th>
                    <th className="py-2 pr-3">目標</th>
                    <th className="py-2 pr-3">影片</th>
                    <th className="py-2">錯誤</th>
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
                        <td className="py-2 pr-3 font-medium">
                          {String(it.type).toLowerCase() === "add"
                            ? "新增"
                            : String(it.type).toLowerCase() === "remove"
                              ? "移除"
                              : String(it.type).toLowerCase() === "move"
                                ? "移轉"
                                : String(it.type).toLowerCase() === "undo"
                                  ? "復原"
                                  : it.type}
                        </td>
                        <td className="py-2 pr-3">
                          {it.status === "success" ? (
                            <Badge color="green">成功</Badge>
                          ) : it.status === "failed" ? (
                            <Badge color="red">失敗</Badge>
                          ) : (
                            <Badge color="yellow">
                              {it.status === "pending" ? "等待中" : it.status}
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
                    aria-label="載入更多項目"
                  >
                    {itemsQuery.isFetchingNextPage ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "載入更多項目"
                    )}
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
