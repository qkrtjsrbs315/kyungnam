"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Sidebar from "./Sidebar";
import { getToken } from "@/lib/auth";

/** 로그인 가드 + 공통 레이아웃. /login 은 사이드바 없이, 그 외에는 토큰 필수. */
export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLogin = pathname === "/login";
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!getToken()) {
      window.location.replace("/login");
      return;
    }
    setReady(true);
  }, [pathname, isLogin]);

  if (isLogin) return <>{children}</>;
  if (!ready) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] min-h-screen">
      <Sidebar />
      <main className="p-5 md:p-7 overflow-auto">{children}</main>
    </div>
  );
}
