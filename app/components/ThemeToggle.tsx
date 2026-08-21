// /app/components/ThemeToggle.tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

const triggerClass =
  "inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border/80 bg-background/60 text-foreground shadow-sm transition hover:bg-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ring-offset-background";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  // 主題只有在 client 端才確定，掛載前先渲染一個等寬占位避免 hydration 不一致
  React.useEffect(() => setMounted(true), []);

  if (!mounted) {
    return <div className={triggerClass} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={triggerClass} aria-label="Toggle theme">
        {isDark ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="min-w-36">
        {THEMES.map(({ value, label, icon: Icon }) => (
          <DropdownMenuItem
            key={value}
            onClick={() => setTheme(value)}
            className="gap-2"
          >
            <Icon className="h-4 w-4" />
            <span className="flex-1">{label}</span>
            <Check
              className={cn(
                "h-4 w-4 text-violet-600 dark:text-violet-300",
                theme === value ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
