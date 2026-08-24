"use client";

import Image from "next/image";
import { cn } from "@/lib/utils";
import type { PlaylistSummary } from "@/types/youtube";
import { Card } from "@/app/components/ui/card";

export interface PlaylistListProps {
  playlists: PlaylistSummary[];
  activeId?: string;
  onSelect?: (playlistId: string) => void;
  isLoading?: boolean;
  selectable?: boolean;
  selectedIds?: Set<string>;
  onToggleSelect?: (playlistId: string, checked: boolean) => void;
}

export function PlaylistList({
  playlists,
  activeId,
  onSelect,
  isLoading,
  selectable = true,
  selectedIds,
  onToggleSelect,
}: PlaylistListProps) {
  if (isLoading) {
    return (
      <div
        className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        role="status"
        aria-label="載入播放清單中"
      >
        {Array.from({ length: 8 }).map((_, index) => (
          <div
            key={index}
            className="overflow-hidden rounded-2xl border border-border bg-card"
          >
            <div className="h-36 animate-pulse bg-muted" />
            <div className="space-y-3 px-4 py-3">
              <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
              <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!playlists.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-card/60 p-10 text-center text-sm text-muted-foreground">
        找不到播放清單。
      </div>
    );
  }

  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {playlists.map((playlist) => {
        const isActive = playlist.id === activeId;
        const isChecked = selectedIds?.has(playlist.id) ?? false;

        const handleClick = () => {
          if (selectable && onToggleSelect) {
            onToggleSelect(playlist.id, !isChecked);
          } else {
            onSelect?.(playlist.id);
          }
        };

        return (
          <div
            key={playlist.id}
            role="button"
            tabIndex={0}
            onClick={handleClick}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                handleClick();
              }
            }}
            className={cn(
              "group relative cursor-pointer text-left",
              "rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
            )}
          >
            {selectable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(playlist.id, !isChecked);
                }}
                aria-label={isChecked ? "取消選取播放清單" : "選取播放清單"}
                className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-card/95 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.9)] transition-all duration-200"
              >
                <span
                  className={cn(
                    "flex h-[16px] w-[16px] items-center justify-center rounded-full border transition-all duration-200",
                    isChecked
                      ? "border-primary bg-primary ring-[3px] ring-primary/40"
                      : "border-slate-200 bg-card dark:border-slate-600",
                  )}
                />
              </button>
            )}

            <Card
              className={cn(
                "flex h-full flex-col overflow-hidden transition-colors duration-150 group-hover:border-primary/40",
                isChecked && "border-primary bg-primary/5",
                isActive && !isChecked && "border-primary/40",
              )}
            >
              {playlist.thumbnailUrl ? (
                <div className="relative h-36 w-full overflow-hidden">
                  <Image
                    src={playlist.thumbnailUrl}
                    alt={playlist.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 300px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                  />
                </div>
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-muted text-sm font-medium text-muted-foreground">
                  無縮圖
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                <div className="line-clamp-2 text-sm font-semibold leading-5 text-foreground">
                  {playlist.title}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-primary/10 px-2 py-1 font-medium text-primary">
                    {playlist.itemCount} 部影片
                  </span>
                  <span>開啟</span>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
