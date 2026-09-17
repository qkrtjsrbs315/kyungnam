"use client";

import { useEffect, useMemo, useState } from "react";
import { api, MonthlyRow, OutboundRow } from "@/lib/api";
import MonthlyChart from "@/components/MonthlyChart";

export default function StatsPage() {
  const [period, setPeriod] = useState<"daily" | "monthly">("monthly");
  const [month, setMonth] = useState(() => new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul", year: "numeric", month: "2-digit",
  }).format(new Date()));
  const [view, setView] = useState<"product" | "size" | "detail">("product");
  const [error, setError] = useState("");
  const [rows, setRows] = useState<OutboundRow[]>([]);
  const [monthly, setMonthly] = useState<MonthlyRow[]>([]);
  const requestKey = `${period}:${month}`;
  const [loadedKey, setLoadedKey] = useState("");
  const loading = loadedKey !== requestKey;

  useEffect(() => {
    api<MonthlyRow[]>("/stats/monthly").then(setMonthly).catch(() => setMonthly([]));
  }, []);

  useEffect(() => {
    let active = true;
    api<OutboundRow[]>(`/stats/outbound?period=${period}${month ? `&month=${month}` : ""}`)
      .then((data) => { if (active) { setRows(data); setError(""); } })
      .catch((e: Error) => { if (active) { setRows([]); setError(e.message); } })
      .finally(() => { if (active) setLoadedKey(requestKey); });
    return () => { active = false; };
  }, [period, month, requestKey]);

  // 기간별로 묶어서 표시
  const grouped = useMemo(() => {
    const map = new Map<string, OutboundRow[]>();
    for (const r of rows) {
      const list = map.get(r.period) ?? [];
      list.push(r);
      map.set(r.period, list);
    }
    return Array.from(map.entries()).map(([date, list]) => {
      const totals = new Map<string, OutboundRow>();
      for (const r of list) {
        const key = view === "product" ? String(r.product_id) : view === "size" ? r.size : `${r.product_id}:${r.size}`;
        const old = totals.get(key);
        totals.set(key, old ? { ...old, qty: old.qty + r.qty } : { ...r });
      }
      return [date, [...totals.values()].sort((a, b) => b.qty - a.qty || a.product_id - b.product_id || a.size.localeCompare(b.size, "ko", { numeric: true }))] as const;
    });
  }, [rows, view]);

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">출고 통계</h1>
          <p className="text-sm text-gray-500 mt-1">월별·일별 출고 수량을 많은 순서로 확인합니다. 반품 수량은 차감하지 않습니다.</p>
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

      <div className="bg-white border border-gray-200 rounded-2xl p-5 mb-4">
        <h3 className="font-extrabold mb-4">월별 입고·출고·반품 (최근 12개월)</h3>
        <MonthlyChart rows={monthly} />
      </div>

      <div className="flex flex-wrap gap-3 items-end mb-4">
        <label className="text-sm">조회 월
          <input aria-label="조회 월" type="month" value={month} onChange={(e) => setMonth(e.target.value)} className="block border border-gray-200 rounded-lg p-2 bg-white mt-1" />
        </label>
        <label className="text-sm">순위 기준
          <select aria-label="순위 기준" value={view} onChange={(e) => setView(e.target.value as typeof view)} className="block border border-gray-200 rounded-lg p-2 bg-white mt-1">
            <option value="product">품목별 순위 (사이즈 합산)</option>
            <option value="size">사이즈별 순위 (전체 품목 합산)</option>
            <option value="detail">품목·사이즈별 순위</option>
          </select>
        </label>
      </div>
      {!loading && error && <p role="alert" className="text-red-600 mb-4">{error}</p>}
      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
          {month || (period === "daily" ? "최근 30일" : "최근 12개월")} 출고 내역이 없습니다.
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
                        <th className="py-2 px-2">순위</th>
                        {view !== "size" && <th className="py-2 px-2">브랜드</th>}
                        {view !== "size" && <th className="py-2 px-2">제품명</th>}
                        {view !== "product" && <th className="py-2 px-2">사이즈</th>}
                        <th className="py-2 px-2 text-right">출고 수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2.5 px-2">{list.findIndex((row) => row.qty === r.qty) + 1}</td>
                          {view !== "size" && <td className="py-2.5 px-2">{r.brand_name ?? "미지정"}</td>}
                          {view !== "size" && <td className="py-2.5 px-2 font-bold">
                            {r.product_model ? `${r.product_model} · ${r.product_name}` : r.product_name}
                          </td>}
                          {view !== "product" && <td className="py-2.5 px-2">{r.size}</td>}
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
