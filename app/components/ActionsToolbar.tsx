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

// ⬇️ shadcn/ui 組件（需要已安裝）
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

  /** 受控目標清單（可為 null） */
  selectedPlaylistId?: string | null;
  /** 受控模式：目標變更回呼（可選） */
  onTargetChange?: (id: string | null) => void;

  /** ✅ 讓 onAdd 也吃 targetId（和 onMove 一致） */
  onAdd: (targetId?: string | null) => void;
  onRemove: () => void;
  /** 可接受 targetId；若父層不傳，仍可維持舊介面呼叫 `onMove()` */
  onMove: (targetId?: string | null) => void;
  onUndo: () => void;

  /** 相容舊版：全域鎖（若提供，會併入三顆按鈕的 disabled） */
  isLoading?: boolean;

  /** 估算配額（顯示用） */
  estimatedQuota?: number;

  /** ✅ 進階版：各自的 loading（優先於 isLoading） */
  addLoading?: boolean;
  removeLoading?: boolean;
  moveLoading?: boolean;

  /** ✅ 是否可復原（控制 Undo 按鈕啟用） */
  canUndo?: boolean;

  /** ✅ 今日配額訊息（可選） */
  todayRemaining?: number;
  todayBudget?: number;
  quotaResetAtISO?: string;
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

  const nothingSelected = selectedCount === 0;

  // 非受控本地狀態（若父層沒提供 selectedPlaylistId 時使用）
  const [localTargetId, setLocalTargetId] = React.useState<string | null>(null);

  // 受控 / 非受控合併值
  const currentTargetId =
    typeof selectedPlaylistId !== "undefined"
      ? selectedPlaylistId
      : localTargetId;

  // Combobox popover
  const [open, setOpen] = React.useState(false);

  // 下拉在新增/移轉進行中鎖住，避免途中換目標
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

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-sm">
        <ListVideo className="h-4 w-4 opacity-70" />
        已勾選：<b>{selectedCount}</b> 部影片
        {typeof props.estimatedQuota === "number" ? (
          <span className="text-muted-foreground">
            （估算配額 {formatUnits(props.estimatedQuota)}）
          </span>
        ) : null}
      </div>

      {/* 今日配額顯示 */}
      {showQuota && (
        <div
          className="ml-auto flex items-center gap-2 rounded-md border px-2 py-1 text-xs"
          title={
            props.quotaResetAtISO
              ? `今日剩餘：${formatUnits(remain)} / ${formatUnits(
                  budget
                )}，重置時間：${props.quotaResetAtISO}`
              : `今日剩餘：${formatUnits(remain)} / ${formatUnits(budget)}`
          }
        >
          <Gauge className="h-3.5 w-3.5 opacity-70" />
          <span className="whitespace-nowrap">
            今日剩餘：<b>{formatUnits(remain)}</b> / {formatUnits(budget)}（
            {percent}%）
          </span>
        </div>
      )}

      <div className={cn("flex items-center gap-2", !showQuota && "ml-auto")}>
        {/* 美化後的可搜尋 DDL（Combobox） */}
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
                !currentTargetId && "text-muted-foreground"
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
                        // 選擇後自動關閉彈窗
                        setOpen(false);
                      }}
                      className="cursor-pointer"
                    >
                      <Check
                        className={cn(
                          "mr-2 h-4 w-4",
                          currentTargetId === p.id ? "opacity-100" : "opacity-0"
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

        {/* 新增到清單（需選目標且有勾選） */}
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

        {/* 從原清單移除（不需目標） */}
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

        {/* 一併移轉（需選目標且有勾選） */}
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

        {/* 復原：只有有可復原動作時才可按 */}
        <Button
          size="sm"
          variant="ghost"
          onClick={props.onUndo}
          disabled={busyAll || !props.canUndo}
          aria-disabled={busyAll || !props.canUndo}
          title={props.canUndo ? "復原上一個動作" : "暫無可復原的動作"}
        >
          <Undo2 className="mr-2 h-4 w-4" />
          復原
        </Button>
      </div>
    </div>
  );
}

export default ActionsToolbar;
