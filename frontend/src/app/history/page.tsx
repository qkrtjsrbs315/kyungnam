"use client";

import { useEffect, useMemo, useState } from "react";
import { api, MOVE_LABEL, Movement, won } from "@/lib/api";

const TYPE_STYLE: Record<Movement["type"], string> = {
  in: "bg-emerald-50 text-emerald-700",
  out: "bg-red-50 text-red-600",
  return: "bg-blue-50 text-blue-700",
};

export default function HistoryPage() {
  const [moves, setMoves] = useState<Movement[]>([]);
  const [filter, setFilter] = useState<"all" | Movement["type"]>("all");

  useEffect(() => {
    api<Movement[]>("/movements?limit=500").then(setMoves).catch(() => {});
  }, []);

  const filtered = useMemo(
    () => (filter === "all" ? moves : moves.filter((m) => m.type === filter)),
    [moves, filter]
  );

  function exportCSV() {
    const rows = [
      ["일시", "구분", "제품", "사이즈", "수량", "거래처", "단가", "금액", "메모"],
      ...filtered.map((m) => [
        new Date(m.created_at).toLocaleString("ko-KR"),
        MOVE_LABEL[m.type],
        m.product_model ? `${m.product_model} ${m.product_name}` : m.product_name ?? "",
        m.variant.size,
        String(m.qty),
        m.client?.name ?? "",
        m.unit_price != null ? String(m.unit_price) : "",
        m.unit_price != null ? String(m.unit_price * m.qty) : "",
        m.memo ?? "",
      ]),
    ];
    const csv =
      "﻿" +
      rows.map((r) => r.map((v) => '"' + String(v).replaceAll('"', '""') + '"').join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    a.download = "재고입출고내역.csv";
    a.click();
  }

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">입출고 내역</h1>
          <p className="text-sm text-gray-500 mt-1">최근 처리된 재고 변동 기록입니다.</p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-gray-200 px-3 py-2 text-sm bg-white"
            value={filter}
            onChange={(e) => setFilter(e.target.value as typeof filter)}
          >
            <option value="all">전체</option>
            <option value="in">입고</option>
            <option value="out">출고</option>
            <option value="return">반품</option>
          </select>
          <button onClick={exportCSV} className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-bold">
            CSV 다운로드
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-500">내역이 없습니다.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[760px]">
              <thead>
                <tr className="text-left text-xs text-gray-500">
                  <th className="py-2.5 px-2">일시</th>
                  <th className="py-2.5 px-2">구분</th>
                  <th className="py-2.5 px-2">제품</th>
                  <th className="py-2.5 px-2">사이즈</th>
                  <th className="py-2.5 px-2 text-right">수량</th>
                  <th className="py-2.5 px-2">거래처</th>
                  <th className="py-2.5 px-2 text-right">금액</th>
                  <th className="py-2.5 px-2">메모</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m) => (
                  <tr key={m.id} className="border-t border-gray-100">
                    <td className="py-3 px-2 whitespace-nowrap">{new Date(m.created_at).toLocaleString("ko-KR")}</td>
                    <td className="py-3 px-2">
                      <span className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${TYPE_STYLE[m.type]}`}>
                        {MOVE_LABEL[m.type]}
                      </span>
                    </td>
                    <td className="py-3 px-2 font-bold">
                      {m.product_model ? `${m.product_model} · ${m.product_name}` : m.product_name}
                    </td>
                    <td className="py-3 px-2">{m.variant.size}</td>
                    <td className={`py-3 px-2 text-right font-extrabold tabular-nums ${m.type === "out" ? "text-red-600" : "text-emerald-700"}`}>
                      {m.type === "out" ? "-" : "+"}
                      {m.qty}
                    </td>
                    <td className="py-3 px-2">{m.client?.name ?? "-"}</td>
                    <td className="py-3 px-2 text-right tabular-nums">
                      {m.unit_price != null ? won(m.unit_price * m.qty) : "-"}
                    </td>
                    <td className="py-3 px-2 text-gray-500">{m.memo ?? "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
