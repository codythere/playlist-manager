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
import { Button } from "@/app/components/ui/button";

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

function BrandMark({ size = 32 }: { size?: number }) {
  return (
    <div
      className="brand-mark shadow-sm"
      style={{ width: size, height: size }}
    >
      <Image src="/logo.png" alt="" width={Math.round(size * 0.56)} height={Math.round(size * 0.56)} />
    </div>
  );
}

export function AppShell({
  children,
  footer,
}: {
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [desktopOpen, setDesktopOpen] = React.useState(true);

  const authQ = useQuery({
    queryKey: ["auth"],
    queryFn: fetchAuthMe,
    staleTime: 0,
    refetchOnMount: true,
    refetchOnWindowFocus: false,
    retry: 0,
  });

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

  const isActive = React.useCallback(
    (href: string) => {
      if (!pathname) return false;
      if (href === "/") return pathname === "/";
      return pathname === href || pathname.startsWith(href + "/");
    },
    [pathname],
  );

  if (pathname === "/login") {
    return (
      <div className="relative min-h-screen">
        <div className="absolute right-4 top-4 z-20">
          <ThemeToggle />
        </div>
        {children}
      </div>
    );
  }

  const goHome = React.useCallback(() => {
    setMobileOpen(false);
    if (pathname === "/") {
      window.dispatchEvent(new Event("ytpm:go-home"));
    }
  }, [pathname]);

  const navLinkClass = (active: boolean) =>
    cn(
      "flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
      active
        ? "bg-primary/10 text-primary"
        : "text-muted-foreground hover:bg-accent hover:text-foreground",
    );

  const NavItems = (
    <nav className="flex h-full flex-col p-4">
      <div className="mb-6 px-1">
        <Link
          href="/"
          aria-label="回到首頁"
          onClick={goHome}
          className="flex items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
        >
          <BrandMark size={30} />
          <div className="min-w-0">
            <div className="truncate text-sm font-semibold tracking-tight">
              Playlist Manager
            </div>
            <div className="text-[11px] text-muted-foreground">批次管理工具</div>
          </div>
        </Link>
      </div>

      <div className="space-y-1">
        <Link href="/" className={navLinkClass(isActive("/"))} onClick={goHome}>
          <ListMusic className="h-4 w-4" />
          播放清單管理
        </Link>
        <Link
          href="/action-log"
          className={navLinkClass(isActive("/action-log"))}
        >
          <History className="h-4 w-4" />
          操作紀錄
        </Link>
      </div>
    </nav>
  );

  return (
    <div className="flex min-h-screen">
      <aside
        className={cn(
          "hidden md:flex md:flex-col fixed left-0 top-0 h-screen overflow-hidden border-r border-border bg-card/80 backdrop-blur-xl transition-[width] duration-200",
          desktopOpen ? "w-60" : "w-0",
        )}
        aria-hidden={!desktopOpen}
      >
        {desktopOpen ? NavItems : null}
      </aside>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent side="left" className="w-60 p-0">
          <SheetHeader>
            <VisuallyHidden>
              <SheetTitle>導覽選單</SheetTitle>
            </VisuallyHidden>
          </SheetHeader>
          {NavItems}
        </SheetContent>
      </Sheet>

      <div
        className={cn(
          "flex-1 transition-all duration-200",
          desktopOpen ? "md:ml-60" : "md:ml-0",
        )}
      >
        <div className="flex min-h-screen flex-col">
          <header className="sticky top-0 z-30 border-b border-border/80 bg-background/80 backdrop-blur-xl">
            <div className="mx-auto flex h-14 w-full max-w-[1500px] items-center gap-3 px-4 md:px-6">
              <button
                aria-label="開啟導覽選單"
                className="icon-btn md:hidden"
                onClick={() => setMobileOpen(true)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <button
                aria-label="切換側邊欄"
                aria-expanded={desktopOpen}
                className="icon-btn hidden md:inline-flex"
                onClick={() => setDesktopOpen((v) => !v)}
              >
                <Menu className="h-5 w-5" />
              </button>

              <div className="flex min-w-0 items-center gap-2.5">
                <Link
                  href="/"
                  aria-label="回到首頁"
                  onClick={goHome}
                  className="flex min-w-0 items-center gap-2.5 rounded-xl outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-ring"
                >
                  <BrandMark />
                  <span className="hidden truncate text-sm font-semibold tracking-tight sm:inline">
                    Playlist Manager
                  </span>
                </Link>
                <span className="chip-beta">🎉 Beta 免費試用中</span>
              </div>

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
                  <Button
                    size="sm"
                    onClick={() =>
                      router.push(
                        `/login?redirect=${encodeURIComponent(
                          window.location.pathname,
                        )}`,
                      )
                    }
                  >
                    登入
                  </Button>
                )}
              </div>
            </div>
          </header>

          <main className="flex-1 px-4 py-5 sm:px-6 lg:px-8">{children}</main>
          {footer ?? null}
        </div>
      </div>
    </div>
  );
}
