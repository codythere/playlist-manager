// app/page.tsx (Server Component)
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import HomeClient from "./HomeClient";

export default async function Page() {
  const user = await getCurrentUser();

  // ❗未登入就重新導向 /login
  if (!user) {
    return redirect("/login");
  }

  // 已登入 → 顯示主介面
  return <HomeClient />;
}
