"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import { Button } from "@/app/components/ui/button";

export type ConfirmOptions = {
  title?: React.ReactNode;
  description?: React.ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
  /** 只顯示單一「知道了」按鈕（隱藏取消） */
  infoOnly?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmCtx = React.createContext<ConfirmFn | null>(null);

export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmCtx);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions>({});
  const resolverRef = React.useRef<((ok: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>((o) => {
    setOpts(o || {});
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const close = (ok: boolean) => {
    setOpen(false);
    // 等一幀讓關閉動畫能跑
    requestAnimationFrame(() => {
      resolverRef.current?.(ok);
      resolverRef.current = null;
    });
  };

  return (
    <ConfirmCtx.Provider value={confirm}>
      {children}

      {open &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center">
            <div
              className="absolute inset-0 bg-black/50 backdrop-blur-[2px]"
              onClick={() => close(false)}
            />
            <div className="relative w-[92vw] max-w-md rounded-2xl border bg-card p-6 shadow-2xl">
              <div className="text-base font-semibold">
                {opts.title ?? "請確認"}
              </div>
              {opts.description ? (
                <div className="mt-2 text-sm text-muted-foreground">
                  {opts.description}
                </div>
              ) : null}
              <div className="mt-4 flex justify-end gap-2">
                {!opts.infoOnly && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => close(false)}
                  >
                    {opts.cancelText ?? "取消"}
                  </Button>
                )}
                <Button
                  type="button"
                  variant={
                    opts.variant === "destructive" ? "destructive" : "default"
                  }
                  onClick={() => close(true)}
                  className="shadow-none hover:shadow-none"
                >
                  {opts.confirmText ?? (opts.infoOnly ? "知道了" : "確定")}
                </Button>
              </div>
            </div>
          </div>,
          document.body
        )}
    </ConfirmCtx.Provider>
  );
}
