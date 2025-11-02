// /app/hooks/useQuota.ts
"use client";

import { useQuery } from "@tanstack/react-query";

export interface QuotaData {
  todayUsed: number;
  todayRemaining: number;
  todayBudget: number;
  resetAtISO: string;
}

export function useQuota(enabled: boolean) {
  return useQuery({
    queryKey: ["quota"],
    queryFn: async (): Promise<QuotaData> => {
      const res = await fetch("/api/quota", {
        credentials: "include",
        cache: "no-store",
      });
      const json = await res.json();
      if (!res.ok || json?.ok === false) {
        throw new Error(json?.error?.message || "Failed to load quota");
      }
      return json.data as QuotaData;
    },
    enabled,
    refetchOnWindowFocus: true,
    staleTime: 10_000,
    refetchInterval: 30_000, // 每 30 秒刷新一次
  });
}
