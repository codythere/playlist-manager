// /app/components/AppShell.tsx
"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { Menu, History, ListMusic } from "lucide-react";
import { cn } from "@/lib/utils";
import Image from "next/image";
import { AvatarMenu } from "@/app/components/AvatarMenu";
import { ThemeToggle } from "@/app/components/ThemeToggle";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/app/components/ui/sheet";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import { useQuery, useQueryClient } from "@tanstack/react-query";

type AuthMe = {
  authenticated: boolean;
  userId: string | null;
  email: string | null;
  usingMock: boolean;
};

async function fetchAuthMe(): Promise<AuthMe> {
  const res = await fetch("/api/auth/me", {
    method: "GET",
    cache: "no-store",
    headers: { "cache-control": "no-store" },
  });
  if (!res.ok) throw new Error("Failed to load auth");
  return res.json();
}

export function AppShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname(); // ✅ 用來判斷目前頁面
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);

  // ✅ 用 React Query 管理登入狀態（與整站統一的 key：["auth"]）
  const authQ = useQuery({
    queryKey: ["auth"],
    queryFn: fetchAuthMe,
    // 登出後要馬上更新，所以不要快取
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 0,
  });

  // ✅ 監聽全域登出/登入事件（保險作法：例如別的元件廣播）
  React.useEffect(() => {
    const onChanged = () => {
      queryClient.invalidateQueries({ queryKey: ["auth"] });
    };
    window.addEventListener("ytpm:auth-changed", onChanged as EventListener);
    return () => {
      window.removeEventListener(
        "ytpm:auth-changed",
        onChanged as EventListener,
      );
    };
  }, [queryClient]);

  const me = authQ.data;
  const loadingMe = authQ.isLoading;

  // ✅ 判斷 active（支援子路由：例如 /action-log/xxx）
  const isActive = React.useCallback(
    (href: string) => {
      if (!pathname) return false;
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname],
  );

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
      active
        ? "bg-gradient-to-r from-violet-600/10 to-indigo-600/10 text-violet-700 ring-1 ring-violet-200 shadow-sm dark:from-violet-500/15 dark:to-indigo-500/15 dark:text-violet-200 dark:ring-violet-500/30"
        : "text-muted-foreground hover:bg-accent/80 hover:text-foreground",
    );

  const NavItems = (
    <nav className="space-y-2 p-4">
      <div className="mb-3 px-2">
        <div className="rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-blue-500 p-[1px] shadow-lg shadow-violet-500/20">
          <div className="rounded-[15px] bg-background/90 px-3 py-2.5 backdrop-blur-sm">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br from-violet-500 to-indigo-500 text-white shadow-sm">
                <ListMusic className="h-3.5 w-3.5" />
              </div>
              Playlist Manager
            </div>
          </div>
        </div>
      </div>

      <Link href="/" className={navLinkClass(isActive("/"))}>
        <ListMusic className="h-4 w-4" />
        Playlist Manager
      </Link>

      <Link
        href="/action-log"
        className={navLinkClass(isActive("/action-log"))}
      >
        <History className="h-4 w-4" />
        Action Log
      </Link>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      {/* Sidebar（桌機固定版） */}
      <aside
        className={cn(
          "hidden md:flex md:flex-col fixed left-0 top-0 h-screen overflow-hidden border-r border-border/80 bg-background/80 shadow-[0_0_40px_-28px_rgba(15,23,42,0.45)] backdrop-blur-xl transition-[width] duration-200",
          desktopOpen ? "w-64" : "w-0",
        )}
        aria-hidden={!desktopOpen}
      >
        {desktopOpen ? (
          <div className="h-full bg-gradient-to-b from-violet-50/70 via-white to-background dark:from-violet-950/20 dark:via-background dark:to-background">
            {NavItems}
          </div>
        ) : null}
      </aside>

      {/* 手機側欄 */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-64 p-0">
          <SheetHeader>
            <VisuallyHidden>
              <SheetTitle>Navigation</SheetTitle>
            </VisuallyHidden>
          </SheetHeader>
          {NavItems}
        </SheetContent>
      </Sheet>

      {/* 內容區 */}
      <div
        className={cn(
          "flex-1 transition-all duration-200",
          desktopOpen ? "md:ml-64" : "md:ml-0",
        )}
      >
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-border/70 bg-background/70 backdrop-blur-xl">
            <div className="mx-auto flex h-16 w-full max-w-[1500px] items-center gap-2 px-4 md:px-6">
              {/* 手機：打開 Sheet */}
              <button
                aria-label="Open navigation"
                className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/60 text-foreground shadow-sm hover:bg-accent md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* 桌機：切換固定側欄 */}
              <button
                aria-label="Toggle sidebar"
                aria-expanded={desktopOpen}
                className="hidden h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/60 text-foreground shadow-sm hover:bg-accent md:inline-flex"
                onClick={() => setDesktopOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* 左側：Logo 與標題 */}
              <div className="flex items-center gap-2 text-sm font-semibold tracking-tight text-foreground sm:text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 shadow-lg shadow-violet-500/25">
                  <Image
                    src="/logo.png"
                    alt="App Logo"
                    width={18}
                    height={18}
                  />
                </div>
                <span className="hidden sm:inline">Playlist Manager</span>
              </div>

              {/* 右側：主題切換 + 使用者區塊（用 React Query 的 auth 狀態） */}
              <div className="ml-auto flex items-center gap-2">
                <ThemeToggle />
                {loadingMe ? (
                  <div className="h-7 w-28 rounded-full bg-muted animate-pulse" />
                ) : me?.authenticated ? (
                  <AvatarMenu
                    user={{
                      name: me.email ?? me.userId ?? "User",
                      email: me.email,
                      image: null,
                    }}
                    redirectTo="/login"
                  />
                ) : (
                  <button
                    className="rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-3.5 py-2 text-sm font-medium text-white shadow-lg shadow-violet-500/25 transition hover:from-violet-500 hover:to-indigo-500"
                    onClick={() =>
                      router.push(
                        `/login?redirect=${encodeURIComponent(
                          window.location.pathname,
                        )}`,
                      )
                    }
                  >
                    Login
                  </button>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 p-4 sm:p-6 lg:p-8">{children}</main>
          {footer ?? null}
        </div>
      </div>
    </div>
  );
}
