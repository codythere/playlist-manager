// /app/components/ThemeToggle.tsx
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Check, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/app/components/ui/dropdown-menu";

const THEMES = [
  { value: "light", label: "淺色", icon: Sun },
  { value: "dark", label: "深色", icon: Moon },
] as const;

const triggerClass = "icon-btn";

export function ThemeToggle() {
  const { theme, setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => setMounted(true), []);

  // 若先前存過 system，改為深色（預設主題）
  React.useEffect(() => {
    if (theme === "system") setTheme("dark");
  }, [theme, setTheme]);

  if (!mounted) {
    return <div className={triggerClass} aria-hidden />;
  }

  const isDark = resolvedTheme === "dark";
  const active = theme === "light" || theme === "dark" ? theme : "dark";

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger className={triggerClass} aria-label="切換主題">
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
                "h-4 w-4 text-primary",
                active === value ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
