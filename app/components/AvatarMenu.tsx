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
      // 直接整頁導向到 GET /api/auth/logout，由伺服器統一處理 redirect
      const next = redirectTo || "/login";
      window.location.href = `/api/auth/logout?next=${encodeURIComponent(
        next
      )}`;
    } finally {
      // 通常不會看到這一行（因為整頁跳轉），保留以防 SPA 情境下的中斷
      setLoading(false);
    }
  };

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        className="inline-flex items-center gap-2 rounded-full px-2 py-1 hover:bg-accent 
                   focus:outline-none focus-visible:outline-none focus-visible:ring-0"
      >
        <Avatar
          src={user?.image ?? null}
          name={user?.name ?? user?.email ?? "U"}
          size={28}
        />
        <span className="hidden text-sm font-medium md:inline">
          {user?.name ?? user?.email ?? "User"}
        </span>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-48">
        <div className="px-2 py-1.5 text-xs text-muted-foreground">
          {user?.email ?? ""}
        </div>
        <DropdownMenuSeparator />

        <DropdownMenuItem disabled onClick={() => {}}>
          <User className="mr-2 h-4 w-4" /> Profile
        </DropdownMenuItem>

        <DropdownMenuItem disabled onClick={() => {}}>
          <Settings className="mr-2 h-4 w-4" /> Settings
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={onLogout}
          className="text-destructive"
          aria-disabled={loading}
        >
          <LogOut className="mr-2 h-4 w-4" />
          {loading ? "Logging out…" : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
