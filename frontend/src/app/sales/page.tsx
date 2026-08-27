"use client";

import { useEffect, useMemo, useState } from "react";
import { api, SalesRow, won } from "@/lib/api";

type Period = "daily" | "weekly" | "monthly";
type Dim = "product" | "size" | "color";

const PERIODS: { key: Period; label: string; days: number }[] = [
  { key: "daily", label: "일별", days: 30 },
  { key: "weekly", label: "주별", days: 91 },
  { key: "monthly", label: "월별", days: 365 },
];
const DIMS: { key: Dim; label: string }[] = [
  { key: "product", label: "품목별" },
  { key: "size", label: "사이즈별" },
  { key: "color", label: "색깔별" },
];

function fmtPeriod(p: string, unit: Period): string {
  if (unit === "monthly") {
    const [y, m] = p.split("-");
    return `${y}년 ${Number(m)}월`;
  }
  if (unit === "weekly") {
    const [y, w] = p.split("-W");
    return `${y}년 ${Number(w)}주차`;
  }
  return p;
}

export default function SalesPage() {
  const [period, setPeriod] = useState<Period>("daily");
  const [dim, setDim] = useState<Dim>("product");
  const [rows, setRows] = useState<SalesRow[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const days = PERIODS.find((p) => p.key === period)!.days;
    setLoading(true);
    api<SalesRow[]>(`/stats/sales?period=${period}&dim=${dim}&days=${days}`)
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [period, dim]);

  const totals = useMemo(
    () =>
      rows.reduce(
        (a, r) => ({
          qty: a.qty + r.out_qty,
          amount: a.amount + r.out_amount,
          returnQty: a.returnQty + r.return_qty,
          returnAmount: a.returnAmount + r.return_amount,
        }),
        { qty: 0, amount: 0, returnQty: 0, returnAmount: 0 }
      ),
    [rows]
  );

  const grouped = useMemo(() => {
    const map = new Map<string, SalesRow[]>();
    for (const r of rows) {
      const list = map.get(r.period) ?? [];
      list.push(r);
      map.set(r.period, list);
    }
    return Array.from(map.entries());
  }, [rows]);

  const toggle = (active: boolean) =>
    `px-4 py-2 rounded-lg text-sm font-bold border ${
      active ? "bg-gray-900 text-white border-gray-900" : "border-gray-200 bg-white"
    }`;

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-extrabold">매출 현황</h1>
        <p className="text-sm text-gray-500 mt-1">
          판매(출고) 품목과 매출액을 기간·분류 기준으로 확인합니다. 매출액은 단가가 입력된 건만 합산됩니다.
        </p>
      </div>

      {/* 필터: 기간 단위 + 분류 기준 */}
      <div className="flex flex-wrap gap-2 mb-5">
        <div className="flex gap-1.5">
          {PERIODS.map((p) => (
            <button key={p.key} onClick={() => setPeriod(p.key)} className={toggle(period === p.key)}>
              {p.label}
            </button>
          ))}
        </div>
        <div className="w-px bg-gray-200 mx-1 hidden md:block" />
        <div className="flex gap-1.5">
          {DIMS.map((d) => (
            <button key={d.key} onClick={() => setDim(d.key)} className={toggle(dim === d.key)}>
              {d.label}
            </button>
          ))}
        </div>
      </div>

      {/* 합계 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5 mb-5">
        {[
          { label: "판매 수량", value: totals.qty.toLocaleString() + "개", sub: `최근 ${PERIODS.find((p) => p.key === period)!.days}일` },
          { label: "매출액", value: won(totals.amount), sub: "출고 합계" },
          { label: "반품", value: `${totals.returnQty.toLocaleString()}개 · ${won(totals.returnAmount)}`, sub: "차감 대상" },
          { label: "순매출", value: won(totals.amount - totals.returnAmount), sub: "매출 - 반품" },
        ].map((s) => (
          <div key={s.label} className="bg-white border border-gray-200 rounded-2xl p-5">
            <div className="text-[13px] text-gray-500">{s.label}</div>
            <div className="text-xl lg:text-2xl font-extrabold mt-2">{s.value}</div>
            <div className="text-xs text-gray-500 mt-1.5">{s.sub}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-gray-500">불러오는 중...</p>
      ) : grouped.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-sm text-gray-500">
          해당 기간에 판매 내역이 없습니다.
        </div>
      ) : (
        <div className="space-y-4">
          {grouped.map(([p, list]) => {
            const sub = list.reduce(
              (a, r) => ({ qty: a.qty + r.out_qty, amount: a.amount + r.out_amount - r.return_amount }),
              { qty: 0, amount: 0 }
            );
            return (
              <div key={p} className="bg-white border border-gray-200 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-extrabold">{fmtPeriod(p, period)}</h3>
                  <span className="text-sm text-gray-500">
                    {sub.qty.toLocaleString()}개 판매 · 순매출{" "}
                    <strong className="text-gray-900 font-extrabold">{won(sub.amount)}</strong>
                  </span>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm min-w-[560px]">
                    <thead>
                      <tr className="text-left text-xs text-gray-500">
                        <th className="py-2 px-2">{DIMS.find((d) => d.key === dim)!.label.replace("별", "")}</th>
                        <th className="py-2 px-2 text-right">판매 수량</th>
                        <th className="py-2 px-2 text-right">매출액</th>
                        <th className="py-2 px-2 text-right">반품</th>
                        <th className="py-2 px-2 text-right">순매출</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((r, i) => (
                        <tr key={i} className="border-t border-gray-100">
                          <td className="py-2.5 px-2 font-bold">{r.key}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums">{r.out_qty.toLocaleString()}개</td>
                          <td className="py-2.5 px-2 text-right tabular-nums">{won(r.out_amount)}</td>
                          <td className="py-2.5 px-2 text-right tabular-nums text-gray-500">
                            {r.return_qty > 0 ? `${r.return_qty}개 · ${won(r.return_amount)}` : "-"}
                          </td>
                          <td className="py-2.5 px-2 text-right tabular-nums font-extrabold">
                            {won(r.out_amount - r.return_amount)}
                          </td>
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
