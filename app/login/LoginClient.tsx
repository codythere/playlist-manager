// /app/login/LoginClient.tsx
"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@/app/components/ui/button";

export default function LoginClient({
  redirectTo = "/",
  error,
  hintEmail,
}: {
  redirectTo?: string;
  error?: string | null;
  hintEmail?: string | null;
}) {
  const [loading, setLoading] = React.useState(false);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      const url = new URL("/api/auth/login", window.location.origin);
      if (redirectTo) url.searchParams.set("redirect", redirectTo);
      window.location.href = url.toString();
    } finally {
      // 不在這裡 setLoading(false)（瀏覽器將跳轉）
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-6 py-10">
      <div className="relative w-full max-w-sm">
        <div className="absolute bottom-full left-0 right-0 mb-4 flex justify-center">
          <span className="rounded-full border border-violet-500/40 bg-violet-500/15 px-3.5 py-1.5 text-sm font-semibold text-violet-700 dark:text-violet-200">
            🎉 Beta 免費試用中
          </span>
        </div>

        <div className="rounded-2xl border border-border/70 bg-card/90 p-8 text-center shadow-sm backdrop-blur-sm">
          <div className="mb-8 flex items-center justify-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-violet-500 via-indigo-500 to-blue-500 shadow-md shadow-violet-500/25">
              <Image src="/logo.png" alt="" width={18} height={18} />
            </div>
            <div className="text-base font-semibold tracking-tight">
              Playlist Manager
            </div>
          </div>

          <h1 className="mb-2 text-2xl font-semibold tracking-tight">登入</h1>
          <p className="mb-6 text-sm leading-6 text-muted-foreground">
            請使用您平時登入 YouTube 的
            <br />
            Google 帳號進行登入
          </p>

          {error ? (
            <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
              {error === "oauth_denied"
                ? "你已取消授權，請再試一次。"
                : error}
            </div>
          ) : null}

          {hintEmail ? (
            <div className="mb-3 text-xs text-muted-foreground">
              繼續使用 <b>{hintEmail}</b>
            </div>
          ) : null}

          <Button
            variant="ghost"
            className="w-full justify-center bg-violet-600 text-white hover:bg-violet-500 hover:text-white"
            style={{ boxShadow: "none" }}
            onClick={handleGoogle}
            aria-label="使用 Google 登入"
            disabled={loading}
          >
            {loading ? "導向中…" : "使用 Google 登入"}
          </Button>

          <p className="mt-6 text-[11px] leading-5 text-muted-foreground">
            登入即表示你同意本服務的{" "}
            <span className="whitespace-nowrap">
              <Link
                href="/terms"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Terms of Use
              </Link>{" "}
              與{" "}
              <Link
                href="/privacy"
                className="underline underline-offset-2 hover:text-foreground"
              >
                Privacy Policy
              </Link>
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
