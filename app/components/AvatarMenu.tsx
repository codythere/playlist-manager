// /app/components/AvatarMenu.tsx
"use client";

import * as React from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";
import { Avatar } from "@/app/components/ui/avatar";
import { LogOut, Settings, User } from "lucide-react";

/**
 * 說明：
 * - 取消 client 端 router.replace，避免和其他地方（middleware/頁面守衛）重複跳轉。
 * - 採用整頁跳轉到 /api/auth/logout?next=...，讓伺服器進行「唯一一次」redirect。
 */
export function AvatarMenu({
  user,
  redirectTo = "/login",
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
  redirectTo?: string;
}) {
  const [loading, setLoading] = React.useState(false);

  const onLogout = async () => {
    try {
      setLoading(true);
      const next = redirectTo || "/login";
      window.location.href = `/api/auth/logout?next=${encodeURIComponent(
        next,
      )}`;
    } finally {
      setLoading(false);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full border border-transparent px-2 py-1 hover:bg-accent 
                   focus:outline-none focus-visible:outline-none focus-visible:ring-0"
      >
        <Avatar
          src={user?.image ?? null}
          name={user?.name ?? user?.email ?? "U"}
          size={28}
        />
        <span className="hidden text-sm font-medium md:inline">
          {user?.name ?? user?.email ?? "使用者"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {user?.email ?? ""}
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled onClick={() => {}}>
          <User className="mr-2 h-4 w-4" /> 個人資料
        </DropdownMenuItem>

        <DropdownMenuItem disabled onClick={() => {}}>
          <Settings className="mr-2 h-4 w-4" /> 設定
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive"
          aria-disabled={loading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loading ? "登出中…" : "登出"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
