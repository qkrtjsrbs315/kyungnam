"use client";

import { useEffect, useMemo, useState } from "react";
import { api, OutboundRow } from "@/lib/api";

export default function StatsPage() {
  const [period, setPeriod] = useState<"daily" | "monthly">("daily");
  const [rows, setRows] = useState<OutboundRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    api<OutboundRow[]>(`/stats/outbound?period=${period}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [period]);

  // 기간별로 묶어서 표시
  const grouped = useMemo(() => {
    const map = new Map<string, OutboundRow[]>();
    for (const r of rows) {
      const list = map.get(r.period) ?? [];
      list.push(r);
      map.set(r.period, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">출고 통계</h1>
          <p className="text-sm text-gray-500 mt-1">일별·월별 품목, 사이즈별 출고 수량을 확인합니다.</p>
        </div>
        <div className="flex gap-2">
          {(["daily", "monthly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border ${
                period === p ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 bg-white"
              }`}
            >
              {p === "daily" ? "일별" : "월별"}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
          {period === "daily" ? "최근 30일" : "최근 12개월"} 출고 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([date, list]) => {
            const total = list.reduce((a, r) => a + r.qty, 0);
            return (
              <div key={date} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold">{date}</h3>
                  <span className="text-sm text-gray-500">
                    총 <strong className="text-gray-900 font-extrabold">{total.toLocaleString()}개</strong> 출고
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[480px]">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 px-2">제품</th>
                        <th className="py-2 px-2">사이즈</th>
                        <th className="py-2 px-2 text-right">출고 수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2.5 px-2 font-bold">
                            {r.product_model ? `${r.product_model} · ${r.product_name}` : r.product_name}
                          </td>
                          <td className="py-2.5 px-2">{r.size}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-bold">{r.qty.toLocaleString()}개</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
