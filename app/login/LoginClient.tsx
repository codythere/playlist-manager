"use client";

import * as React from "react";
import Image from "next/image";
import Link from "next/link";
import {
  Check,
  Layers3,
  ListMusic,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/app/components/ui/button";

const FEATURES = [
  {
    icon: Layers3,
    title: "批次整理",
    body: "一次新增、移除或移轉多部影片",
  },
  {
    icon: ShieldCheck,
    title: "先確認再執行",
    body: "每一步操作都會二次確認，避免誤改",
  },
  {
    icon: ListMusic,
    title: "操作可回顧",
    body: "紀錄與配額都看得到，過程不是黑箱",
  },
];

const SAMPLE_LISTS = [
  { title: "週末精選", count: 42, tone: "bg-primary" },
  { title: "專注工作", count: 28, tone: "bg-amber-500" },
  { title: "運動節奏", count: 16, tone: "bg-emerald-500" },
];

function GoogleMark() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/google.svg" alt="" width={20} height={20} className="h-5 w-5" />
  );
}

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
    <div className="relative isolate min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
      >
        <div className="absolute -left-24 top-[-12%] h-[28rem] w-[28rem] rounded-full bg-primary/15 blur-3xl dark:bg-primary/20" />
        <div className="absolute -right-16 bottom-[-18%] h-[26rem] w-[26rem] rounded-full bg-amber-400/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(to_right,hsl(var(--border)/0.45)_1px,transparent_1px),linear-gradient(to_bottom,hsl(var(--border)/0.45)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:radial-gradient(ellipse_at_center,black_38%,transparent_78%)]" />
      </div>

      <div className="mx-auto grid min-h-screen w-full max-w-6xl lg:grid-cols-[1.05fr_0.95fr]">
        <section className="hidden flex-col justify-center px-10 py-16 lg:flex xl:px-16">
          <div className="mb-8 flex items-center gap-3">
            <div className="brand-mark h-11 w-11 shadow-sm">
              <Image src="/logo.png" alt="" width={22} height={22} />
            </div>
            <div>
              <div className="text-lg font-semibold tracking-tight">
                Playlist Manager
              </div>
              <div className="text-sm text-muted-foreground">
                YouTube 播放清單批次工具
              </div>
            </div>
          </div>

          <h1 className="max-w-md text-4xl font-semibold tracking-tight text-foreground xl:text-[2.6rem] xl:leading-tight">
            把播放清單整理成
            <br />
            <span className="text-primary">你真正會看的樣子</span>
          </h1>
          <p className="mt-4 max-w-md text-[15px] leading-7 text-muted-foreground">
            登入後即可批次管理你的 YouTube 播放清單。不會下載影片，也不會把資料交給第三方。
          </p>

          <ul className="mt-10 max-w-md space-y-4">
            {FEATURES.map(({ icon: Icon, title, body }) => (
              <li key={title} className="flex gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Icon className="h-4 w-4" />
                </span>
                <span>
                  <div className="text-sm font-medium text-foreground">
                    {title}
                  </div>
                  <div className="text-sm text-muted-foreground">{body}</div>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-12 max-w-sm space-y-3">
            {SAMPLE_LISTS.map((list, index) => (
              <div
                key={list.title}
                className="flex items-center gap-3 rounded-2xl border border-border/80 bg-card/70 px-4 py-3 shadow-sm backdrop-blur-sm"
                style={{ marginLeft: index * 12 }}
              >
                <span
                  className={`h-10 w-10 shrink-0 rounded-xl ${list.tone} opacity-90`}
                />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {list.title}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {list.count} 部影片
                  </div>
                </div>
                <Check className="h-4 w-4 text-primary" />
              </div>
            ))}
          </div>
        </section>

        <section className="flex items-center justify-center px-5 py-16 sm:px-8">
          <div className="w-full max-w-[400px]">
            <div className="mb-5 flex items-center justify-center gap-2.5 lg:hidden">
              <div className="brand-mark h-9 w-9 shadow-sm">
                <Image src="/logo.png" alt="" width={18} height={18} />
              </div>
              <div className="text-base font-semibold tracking-tight">
                Playlist Manager
              </div>
            </div>

            <div className="mb-4 flex justify-center">
              <span className="chip-beta px-3.5 py-1.5 text-sm">
                🎉 Beta 免費試用中
              </span>
            </div>

            <div className="rounded-3xl border border-border/80 bg-card/90 p-7 shadow-[0_28px_70px_-40px_rgba(15,15,20,0.65)] backdrop-blur-xl sm:p-8">
              <h2 className="text-center text-2xl font-semibold tracking-tight">
                登入
              </h2>
              <p className="mt-2 text-center text-sm leading-6 text-muted-foreground">
                請使用您平時登入 YouTube 的
                <br />
                Google 帳號進行登入
              </p>

              {error ? (
                <div className="mt-5 rounded-xl border border-destructive/30 bg-destructive/5 px-3 py-2 text-left text-sm text-destructive">
                  {error === "oauth_denied"
                    ? "你已取消授權，請再試一次。"
                    : error}
                </div>
              ) : null}

              {hintEmail ? (
                <div className="mt-4 rounded-xl bg-muted/70 px-3 py-2 text-center text-xs text-muted-foreground">
                  繼續使用 <b className="text-foreground">{hintEmail}</b>
                </div>
              ) : null}

              <Button
                size="lg"
                variant="outline"
                className="mt-6 h-12 w-full gap-2.5 bg-background text-[15px] text-foreground hover:bg-muted"
                onClick={handleGoogle}
                aria-label="使用 Google 登入"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <GoogleMark />
                )}
                使用 Google 登入
              </Button>

              <p className="mt-3 text-center text-[11px] text-muted-foreground">
                僅申請播放清單相關權限，不會下載影片
              </p>

              <div className="mt-6 grid grid-cols-3 gap-2 text-center text-[11px] text-muted-foreground lg:hidden">
                {FEATURES.map(({ title }) => (
                  <div
                    key={title}
                    className="rounded-xl border border-border/70 bg-muted/40 px-2 py-2"
                  >
                    {title}
                  </div>
                ))}
              </div>

              <p className="mt-6 text-center text-[11px] leading-5 text-muted-foreground">
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
        </section>
      </div>
    </div>
  );
}
