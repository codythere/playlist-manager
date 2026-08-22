"use client";

import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "./use-toast";

const ToastViewport = React.forwardRef<
  React.ComponentRef<typeof ToastPrimitive.Viewport>,
  React.ComponentPropsWithoutRef<typeof ToastPrimitive.Viewport>
>(({ className, ...props }, ref) => (
  <ToastPrimitive.Viewport
    ref={ref}
    className={cn(
      "fixed top-0 right-0 z-50 flex max-h-screen w-full flex-col-reverse gap-2 p-4 sm:max-w-sm",
      className
    )}
    {...props}
  />
));
ToastViewport.displayName = ToastPrimitive.Viewport.displayName;

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    <ToastPrimitive.Provider swipeDirection="right">
      {toasts.map((toast) => (
        <ToastPrimitive.Root
          key={toast.id}
          className={cn(
            "pointer-events-auto relative flex w-full items-start space-x-3 rounded-2xl border bg-card p-4 shadow-lg",
            "data-[state=open]:animate-in data-[state=closed]:animate-out data-[swipe=move]:translate-x-[var(--radix-toast-swipe-move-x)] data-[swipe=cancel]:translate-x-0 data-[state=closed]:fade-out-80 data-[state=open]:fade-in-80 data-[state=closed]:slide-out-to-right-full data-[state=open]:slide-in-from-right-full"
          )}
          onOpenChange={(open) => {
            if (!open) dismiss(toast.id);
          }}
        >
          <div className="flex-1">
            {toast.title ? (
              <ToastPrimitive.Title className="text-sm font-semibold text-foreground">
                {toast.title}
              </ToastPrimitive.Title>
            ) : null}
            {toast.description ? (
              <ToastPrimitive.Description className="mt-1 text-sm text-muted-foreground">
                {toast.description}
              </ToastPrimitive.Description>
            ) : null}
            {toast.action ? <div className="mt-3">{toast.action}</div> : null}
          </div>
          <ToastPrimitive.Close
            className="rounded-md p-1 text-muted-foreground transition hover:bg-muted"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </ToastPrimitive.Close>
        </ToastPrimitive.Root>
      ))}
      <ToastViewport />
    </ToastPrimitive.Provider>
  );
}
