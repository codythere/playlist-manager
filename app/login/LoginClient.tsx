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
          <span className="chip-beta px-3.5 py-1.5 text-sm">
            🎉 Beta 免費試用中
          </span>
        </div>

        <div className="rounded-2xl border border-border bg-card p-8 text-center shadow-[0_24px_60px_-36px_rgba(0,0,0,0.55)]">
          <div className="mb-7 flex items-center justify-center gap-2.5">
            <div className="brand-mark h-9 w-9">
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
            <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
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
            className="w-full"
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
