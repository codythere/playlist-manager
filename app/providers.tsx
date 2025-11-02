"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import * as React from "react";
import { ToastProvider } from "@/app/components/ui/use-toast";
import { Toaster } from "@/app/components/ui/toast";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * ✅ 全域止血：避免背景自動重撈
             * - 不因為視窗聚焦/網路恢復而重撈
             * - 不在第一次 mount 就強制重撈（各 query 視需要再覆寫）
             * - 提高 staleTime，降低不必要 request
             */
            refetchOnMount: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: false,
            retry: 1,
            staleTime: 5 * 60_000, // 5 分鐘內視為新鮮
            gcTime: 30 * 60_000, // 30 分鐘回收 cache
          },
          mutations: {
            retry: 0,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ToastProvider>
        {children}
        <Toaster />
      </ToastProvider>
      <ReactQueryDevtools initialIsOpen={false} />
    </QueryClientProvider>
  );
}
