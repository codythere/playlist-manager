"use client";

import Link from "next/link";
import { Github } from "lucide-react";
import pkg from "../../package.json";

export function Footer() {
  const version = pkg.version;

  return (
    <footer
      aria-label="頁尾法務與安全說明"
      className="mt-auto border-t border-border/80 px-4 py-5 text-xs text-muted-foreground"
    >
      <div className="mx-auto max-w-6xl space-y-3 leading-relaxed">
        <div className="space-y-1">
          <p>
            本工具僅在使用者登入期間使用其帳號授權操作，不會將 YouTube Data
            長期寫入資料庫或傳給第三方。不提供內容下載、匯出或對外同步。
          </p>
          <p>
            任何批次操作都需要手動點擊並二次確認。配額不足（
            <code>quotaExceeded</code>
            ）時會暫停對應功能。
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px]">
          <span>Playlist Manager · v{version}</span>
          <span className="opacity-40">·</span>
          <Link href="/privacy" className="hover:text-foreground">
            Privacy Policy
          </Link>
          <span className="opacity-40">·</span>
          <Link href="/terms" className="hover:text-foreground">
            Terms of Use
          </Link>
          <Link
            href="https://github.com/codythere/yt-playlist-manager"
            target="_blank"
            rel="noopener noreferrer"
            className="ml-auto inline-flex items-center gap-1 hover:text-foreground"
          >
            <Github className="h-3.5 w-3.5" />
            GitHub
          </Link>
        </div>
      </div>
    </footer>
  );
}
