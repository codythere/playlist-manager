// /app/login/page.tsx
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import type { Metadata } from "next";
import LoginClient from "./LoginClient";
import { resolveAuthContext } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Sign in | Playlist Manager",
};

// ✅ 在 Next 15，searchParams 需 await 後使用
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const ctx = await resolveAuthContext();

  // 先 await，再安全取值
  const sp = await searchParams;
  const rawRedirect = (typeof sp?.redirect === "string" && sp.redirect) || "/";

  // ✅ 防止 open redirect：只允許站內路徑
  const redirectTo =
    rawRedirect.startsWith("/") && !rawRedirect.startsWith("//")
      ? rawRedirect
      : "/";

  if (ctx.loggedIn) {
    redirect(redirectTo);
  }

  const error = typeof sp?.error === "string" ? sp.error : null;

  const store = await cookies();
  const hintEmail = store.get("ytpm_hint_email")?.value ?? null;

  return (
    <LoginClient redirectTo={redirectTo} error={error} hintEmail={hintEmail} />
  );
}
