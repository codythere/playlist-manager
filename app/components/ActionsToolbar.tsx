// /app/components/ActionsToolbar.tsx
"use client";

import * as React from "react";
import { Button } from "@/app/components/ui/button";
import type { PlaylistSummary } from "@/types/youtube";
import {
  Loader2,
  Check,
  ChevronsUpDown,
  ListPlus,
  MoveRight,
  Undo2,
  Trash2,
  ListVideo,
  Gauge,
} from "lucide-react";
import { cn } from "@/lib/utils";

import {
  Popover,
  PopoverTrigger,
  PopoverContent,
} from "@/app/components/ui/popover";
import {
  Command,
  CommandInput,
  CommandEmpty,
  CommandList,
  CommandGroup,
  CommandItem,
} from "@/app/components/ui/command";

export interface ActionsToolbarProps {
  selectedCount: number;
  playlists: PlaylistSummary[];
  selectedPlaylistId?: string | null;
  onTargetChange?: (id: string | null) => void;
  onAdd: (targetId?: string | null) => void;
  onRemove: () => void;
  onMove: (targetId?: string | null) => void;
  onUndo: () => void;
  isLoading?: boolean;
  estimatedQuota?: number;
  addLoading?: boolean;
  removeLoading?: boolean;
  moveLoading?: boolean;
  undoLoading?: boolean;
  canUndo?: boolean;
  todayRemaining?: number;
  todayBudget?: number;
  quotaResetAtISO?: string;
  videoOpsTotal?: number;
  videoOpsUpdatedAtISO?: string;
}

function formatUnits(n: number) {
  return new Intl.NumberFormat().format(n);
}

export function ActionsToolbar(props: ActionsToolbarProps) {
  const {
    selectedCount,
    playlists,
    selectedPlaylistId,
    onTargetChange,
    onAdd,
    onRemove,
    onMove,
    onUndo,
  } = props;

  const busyAll = Boolean(props.isLoading);
  const addBusy = Boolean(props.addLoading) || busyAll;
  const removeBusy = Boolean(props.removeLoading) || busyAll;
  const moveBusy = Boolean(props.moveLoading) || busyAll;
  const undoBusy = Boolean(props.undoLoading) || busyAll;
  const nothingSelected = selectedCount === 0;

  const [localTargetId, setLocalTargetId] = React.useState<string | null>(null);
  const currentTargetId =
    typeof selectedPlaylistId !== "undefined"
      ? selectedPlaylistId
      : localTargetId;
  const [open, setOpen] = React.useState(false);
  const targetDisabled = addBusy || moveBusy;

  const handleChange = (id: string | null) => {
    if (onTargetChange) onTargetChange(id);
    else setLocalTargetId(id);
  };

  const currentTitle =
    playlists.find((p) => p.id === currentTargetId)?.title ??
    "選擇目標播放清單";

  const showQuota =
    typeof props.todayRemaining === "number" &&
    typeof props.todayBudget === "number";
  const remain = props.todayRemaining ?? 0;
  const budget = props.todayBudget ?? 0;
  const percent = budget > 0 ? Math.round((remain / budget) * 100) : 0;
  const showVideoOps = typeof props.videoOpsTotal === "number";
  const videoOpsTitle = props.videoOpsUpdatedAtISO
    ? `全站影片操作總數：${formatUnits(
        props.videoOpsTotal ?? 0,
      )}（更新於 ${new Date(props.videoOpsUpdatedAtISO).toLocaleString()}）`
    : `全站影片操作總數：${formatUnits(props.videoOpsTotal ?? 0)}`;

  return (
    <div className="space-y-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm">
          <ListVideo className="h-4 w-4 text-muted-foreground" />
          已勾選 <b className="tabular-nums">{selectedCount}</b> 部影片
          {typeof props.estimatedQuota === "number" ? (
            <span className="text-muted-foreground">
              · 估算配額 {formatUnits(props.estimatedQuota)}
            </span>
          ) : null}
        </div>

        {(showQuota || showVideoOps) && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {showQuota && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1"
                title={
                  props.quotaResetAtISO
                    ? `今日剩餘：${formatUnits(remain)} / ${formatUnits(
                        budget,
                      )}，重置時間：${props.quotaResetAtISO}`
                    : `今日剩餘：${formatUnits(remain)} / ${formatUnits(budget)}`
                }
              >
                <Gauge className="h-3.5 w-3.5 opacity-70" />
                <span>
                  今日剩餘 <b>{formatUnits(remain)}</b> / {formatUnits(budget)}（
                  {percent}%）
                </span>
              </div>
            )}
            {showVideoOps && (
              <div
                className="flex items-center gap-1.5 rounded-full border border-border bg-muted/40 px-2.5 py-1"
                title={videoOpsTitle}
              >
                <ListVideo className="h-3.5 w-3.5 opacity-70" />
                <span>
                  累計操作 <b>{formatUnits(props.videoOpsTotal ?? 0)}</b>
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              role="combobox"
              aria-expanded={open}
              aria-label="目標播放清單"
              disabled={targetDisabled || playlists.length === 0}
              className={cn(
                "w-[260px] justify-between",
                !currentTargetId && "text-muted-foreground",
              )}
              title={currentTitle}
            >
              <span className="truncate">{currentTitle}</span>
              <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-60" />
            </Button>
          </PopoverTrigger>

          <PopoverContent className="w-[320px] p-0" align="start">
            <Command>
              <CommandInput placeholder="搜尋播放清單..." />
              <CommandEmpty>找不到相符的播放清單</CommandEmpty>
              <CommandList>
                <CommandGroup heading="全部播放清單">
                  {playlists.map((p) => (
                    <CommandItem
                      key={p.id}
                      value={p.title + " " + p.id}
                      onSelect={() => {
                        const next = p.id === currentTargetId ? null : p.id;
                        handleChange(next);
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentTargetId === p.id
                            ? "opacity-100"
                            : "opacity-0",
                        )}
                      />
                      <span className="truncate">{p.title}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>

        <Button
          size="sm"
          variant="secondary"
          onClick={() => onAdd(currentTargetId)}
          disabled={addBusy || nothingSelected || !currentTargetId}
          aria-disabled={addBusy || nothingSelected || !currentTargetId}
        >
          {addBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              新增中…
            </>
          ) : (
            <>
              <ListPlus className="mr-2 h-4 w-4" />
              新增到清單
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="outline"
          onClick={onRemove}
          disabled={removeBusy || nothingSelected}
          aria-disabled={removeBusy || nothingSelected}
        >
          {removeBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              移除中…
            </>
          ) : (
            <>
              <Trash2 className="mr-2 h-4 w-4" />
              從原清單移除
            </>
          )}
        </Button>

        <Button
          size="sm"
          onClick={() => onMove(currentTargetId)}
          disabled={moveBusy || nothingSelected || !currentTargetId}
          aria-disabled={moveBusy || nothingSelected || !currentTargetId}
        >
          {moveBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              移轉中…
            </>
          ) : (
            <>
              <MoveRight className="mr-2 h-4 w-4" />
              一併移轉
            </>
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={onUndo}
          disabled={undoBusy || !props.canUndo}
          aria-disabled={undoBusy || !props.canUndo}
          title={props.canUndo ? "復原上一個動作" : "暫無可復原的動作"}
        >
          {undoBusy ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              復原中…
            </>
          ) : (
            <>
              <Undo2 className="mr-2 h-4 w-4" />
              復原
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

export default ActionsToolbar;
