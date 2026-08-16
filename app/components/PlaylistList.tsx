"use client";

import Image from "next/image";
import * as React from "react";
import { Check } from "lucide-react";
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
      <div className="rounded-2xl border border-dashed border-border bg-white/50 p-8 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
        Loading playlists
      </div>
    );
  }

  if (!playlists.length) {
    return (
      <div className="rounded-2xl border border-dashed border-border bg-white/50 p-8 text-center text-sm text-muted-foreground shadow-sm backdrop-blur-sm">
        No playlists found.
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
            className={cn(
              "group relative cursor-pointer text-left",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded-2xl",
            )}
          >
            {selectable && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onToggleSelect?.(playlist.id, !isChecked);
                }}
                aria-label={isChecked ? "Unselect playlist" : "Select playlist"}
                className={cn(
                  "absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-full bg-white/95 shadow-[0_8px_18px_-12px_rgba(15,23,42,0.9)] transition-all duration-200",
                  isChecked &&
                    "shadow-[0_8px_18px_-12px_rgba(15,23,42,0.9),inset_0_0_0_2px_rgba(196,181,253,0.8)]",
                )}
              >
                <span
                  className={cn(
                    "flex h-[16px] w-[16px] items-center justify-center rounded-full border transition-all duration-200",
                    isChecked
                      ? "border-violet-600 bg-violet-600 shadow-[0_0_0_1px_rgba(124,58,237,0.12)]"
                      : "border-slate-200 bg-white",
                  )}
                >
                  {isChecked ? (
                    <Check className="h-3 w-3 stroke-[3] text-white" />
                  ) : null}
                </span>
              </button>
            )}

            <Card
              className={cn(
                "flex h-full flex-col overflow-hidden border transition-all duration-200 group-hover:-translate-y-0.5 group-hover:shadow-[0_20px_35px_-24px_rgba(15,23,42,0.45)]",
                isChecked
                  ? "border-violet-300 bg-violet-50/60 shadow-[0_18px_30px_-22px_rgba(109,40,217,0.7)] ring-0"
                  : "border-slate-200/80 bg-white/90",
                isActive && !isChecked && "border-violet-200 bg-violet-50/30",
              )}
            >
              {playlist.thumbnailUrl ? (
                <div className="relative h-36 w-full overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-violet-600/10 via-transparent to-indigo-600/10" />
                  <Image
                    src={playlist.thumbnailUrl}
                    alt={playlist.title}
                    fill
                    sizes="(max-width: 768px) 100vw, (max-width: 1200px) 33vw, 300px"
                    className="object-cover transition-transform duration-300 group-hover:scale-[1.04]"
                  />
                </div>
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-gradient-to-br from-slate-100 to-violet-100 text-sm font-medium text-muted-foreground dark:from-slate-800 dark:to-violet-950/60">
                  No thumbnail
                </div>
              )}
              <div className="flex flex-1 flex-col gap-2 px-4 py-3">
                <div className="text-sm font-semibold leading-5 text-foreground line-clamp-2">
                  {playlist.title}
                </div>
                <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span className="rounded-full bg-violet-100 px-2 py-1 font-medium text-violet-700 dark:bg-violet-500/10 dark:text-violet-200">
                    {playlist.itemCount} items
                  </span>
                  <span>Open</span>
                </div>
              </div>
            </Card>
          </div>
        );
      })}
    </div>
  );
}
