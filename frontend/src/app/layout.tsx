import type { Metadata } from "next";
import { Noto_Sans_KR } from "next/font/google";
import "./globals.css";
import AppShell from "@/components/AppShell";

const notoSansKr = Noto_Sans_KR({ subsets: ["latin"], weight: ["400", "500", "700", "800"] });

export const metadata: Metadata = {
  title: "경남산업 재고관리",
  description: "안전화·용품 재고관리 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body className={notoSansKr.className}>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
