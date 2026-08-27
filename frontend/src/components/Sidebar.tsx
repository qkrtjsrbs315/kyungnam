"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import PushButton from "./PushButton";

const NAV = [
  { href: "/", label: "대시보드" },
  { href: "/products", label: "제품·재고" },
  { href: "/movements", label: "입고·출고" },
  { href: "/history", label: "입출고 내역" },
  { href: "/clients", label: "거래처" },
  { href: "/stats", label: "출고 통계" },
];

export default function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="bg-gray-900 text-white p-4 md:p-6 md:min-h-screen sticky top-0 z-10">
      <div className="font-extrabold text-xl px-2 mb-1">경남산업</div>
      <div className="text-xs text-gray-400 px-2 mb-6 hidden md:block">재고관리 시스템</div>
      <div className="flex md:block items-center gap-2">
        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {NAV.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`whitespace-nowrap rounded-lg px-3.5 py-2.5 text-[15px] transition-colors ${
                  active ? "bg-gray-800 text-white font-bold" : "text-slate-300 hover:bg-gray-800 hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <PushButton />
      </div>
    </aside>
  );
}
