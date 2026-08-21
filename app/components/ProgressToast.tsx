"use client";

import * as React from "react";
import { useToast } from "@/app/components/ui/use-toast";

interface ProgressToastProps {
  status: "idle" | "loading" | "success" | "error";
  actionLabel: string;
  successMessage?: string;
  errorMessage?: string;
}

/**
 * 只負責結束後的成功／失敗提示。
 * 「進行中」交給全域進度面板（OperationProgress），避免兩個地方同時說同一件事。
 */
export function ProgressToast({
  status,
  actionLabel,
  successMessage,
  errorMessage,
}: ProgressToastProps) {
  const { toast } = useToast();

  React.useEffect(() => {
    if (status === "success") {
      toast({
        title: successMessage ?? `${actionLabel} 完成`,
        duration: 4000,
      });
      return;
    }

    if (status === "error") {
      toast({
        title: `${actionLabel} 失敗`,
        description: errorMessage ?? "可至『操作紀錄』查看詳細錯誤。",
        duration: 5000,
      });
      return;
    }
  }, [status, actionLabel, successMessage, errorMessage, toast]);

  return null;
}
