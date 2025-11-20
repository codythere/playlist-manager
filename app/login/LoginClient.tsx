// /app/login/LoginClient.tsx
"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/app/components/ui/button";
import { cn } from "@/lib/utils";

export default function LoginClient({
  redirectTo = "/",
  error,
  hintEmail,
}: {
  redirectTo?: string;
  error?: string | null;
  hintEmail?: string | null;
}) {
  const router = useRouter();
  const [loading, setLoading] = React.useState(false);

  const handleGoogle = async () => {
    try {
      setLoading(true);
      // 如果你的 /api/auth/login 支援 redirect 參數，就帶上
      const url = new URL("/api/auth/login", window.location.origin);
      if (redirectTo) url.searchParams.set("redirect", redirectTo);
      window.location.href = url.toString();
    } finally {
      // 不在這裡 setLoading(false)（瀏覽器將跳轉）
    }
  };

  return (
    <div className="grid place-items-center px-6 pt-[120px]">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-6 shadow-sm">
        {/* Logo + Title */}
        <div className="mb-6 flex items-center gap-2">
          <Image src="/logo.png" alt="App Logo" width={24} height={24} />
          <div className="text-base font-semibold">Playlist Manager</div>
        </div>

        <h1 className="mb-1 text-xl font-semibold">Sign in</h1>
        <p className="mb-4 text-sm text-muted-foreground">
          Use your Google account to manage your playlists.
        </p>

        {/* 錯誤訊息（可選） */}
        {error ? (
          <div className="mb-4 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error === "oauth_denied"
              ? "You cancelled the authorization. Please try again."
              : error}
          </div>
        ) : null}

        {/* Email 提示（可選） */}
        {hintEmail ? (
          <div className="mb-3 text-xs text-muted-foreground">
            Continue as <b>{hintEmail}</b>
          </div>
        ) : null}

        <div className="space-y-3">
          <Button
            className="w-full justify-center"
            onClick={handleGoogle}
            aria-label="Sign in with Google"
            disabled={loading}
          >
            {loading ? (
              "Redirecting…"
            ) : (
              <span className="inline-flex items-center gap-2">
                {/* 你可以換成自己的 SVG，這裡用 next/image 引入本地圖檔亦可 */}
                {/* <Image
                  src="/google.svg"
                  alt=""
                  width={24}
                  height={24}
                  aria-hidden
                /> */}
                Sign in with Google
              </span>
            )}
          </Button>

          {/* （可選）之後若要加更多 IdP / Email Magic Link，在這裡擴充 */}
        </div>

        {/* 裝飾 / 條款（可選） */}
        <p className="mt-6 text-center text-xs text-muted-foreground">
          By signing in, you agree to our Terms and Privacy Policy.
        </p>
      </div>
    </div>
  );
}
