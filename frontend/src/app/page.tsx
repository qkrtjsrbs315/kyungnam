"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, Dashboard, MOVE_LABEL, Movement, Product, productLabel } from "@/lib/api";

export default function DashboardPage() {
  const [stats, setStats] = useState<Dashboard | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [moves, setMoves] = useState<Movement[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    Promise.all([
      api<Dashboard>("/stats/dashboard"),
      api<Product[]>("/products"),
      api<Movement[]>("/movements?limit=6"),
    ])
      .then(([s, p, m]) => {
        setStats(s);
        setProducts(p);
        setMoves(m);
      })
      .catch((e) => setError(e.message));
  }, []);

  const totalOf = (p: Product) => p.variants.reduce((a, v) => a + v.stock, 0);
  const hasLow = (p: Product) => p.variants.some((v) => v.stock <= p.low_stock_threshold);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">재고 대시보드</h1>
          <p className="text-sm text-gray-500 mt-1">제품과 사이즈별 재고를 한눈에 확인합니다.</p>
        </div>
        <Link href="/products" className="rounded-lg bg-gray-900 text-white font-bold px-4 py-2.5 text-center">
          + 제품 등록
        </Link>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-sm">
          백엔드 연결 실패: {error} — FastAPI 서버가 실행 중인지 확인해주세요.
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: "총 재고", value: stats ? stats.total_stock.toLocaleString() + "개" : "-", sub: "전체 사이즈 합계" },
          { label: "등록 제품", value: stats ? stats.product_count + "개" : "-", sub: "신발·용품 합계" },
          { label: "부족 재고", value: stats ? stats.low_stock_count + "건" : "-", sub: "기준 수량 이하 사이즈" },
          { label: "오늘 입·출고", value: stats ? stats.today_movements + "건" : "-", sub: "처리 건수" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-4.5 p-5">
            <div className="text-[13px] text-gray-500">{s.label}</div>
            <div className="text-2xl lg:text-[28px] font-extrabold mt-2">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1.5">{s.sub}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-3.5">
            <h3 className="font-extrabold">제품별 재고</h3>
            <Link href="/products" className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold">
              전체보기
            </Link>
          </div>
          {products.length === 0 ? (
            <p className="text-sm text-gray-500">등록된 제품이 없습니다.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500">
                    <th className="py-2.5 px-2">제품</th>
                    <th className="py-2.5 px-2">구분</th>
                    <th className="py-2.5 px-2 text-right">재고</th>
                    <th className="py-2.5 px-2">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 7).map((p) => (
                    <tr key={p.id} className="border-t border-gray-100">
                      <td className="py-3 px-2 font-bold">{productLabel(p)}</td>
                      <td className="py-3 px-2 text-gray-500">{p.category === "shoe" ? "신발" : "용품"}</td>
                      <td className="py-3 px-2 text-right tabular-nums">{totalOf(p).toLocaleString()}개</td>
                      <td className="py-3 px-2">
                        <span
                          className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                            hasLow(p) ? "bg-red-50 text-red-600" : "bg-emerald-50 text-emerald-700"
                          }`}
                        >
                          {hasLow(p) ? "확인필요" : "정상"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="font-extrabold mb-3.5">최근 입출고</h3>
          {moves.length === 0 ? (
            <p className="text-sm text-gray-500">아직 입출고 내역이 없습니다.</p>
          ) : (
            moves.map((m) => (
              <div key={m.id} className="flex justify-between py-3 border-b border-gray-100 last:border-0">
                <div>
                  <strong className="text-sm">
                    {m.product_model ?? m.product_name} · {m.variant.size}
                  </strong>
                  <small className="block text-gray-500 mt-1">
                    {m.client?.name ?? m.memo ?? "메모 없음"} · {new Date(m.created_at).toLocaleString("ko-KR")}
                  </small>
                </div>
                <div className={`font-extrabold ${m.type === "out" ? "text-red-600" : "text-emerald-700"}`}>
                  {m.type === "out" ? "-" : "+"}
                  {m.qty} <span className="text-xs font-bold">({MOVE_LABEL[m.type]})</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
