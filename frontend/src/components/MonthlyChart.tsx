"use client";

import { useMemo, useState } from "react";
import { MonthlyRow } from "@/lib/api";

// 검증된 카테고리 팔레트 (dataviz: 슬롯 1~3, 흰 배경 기준 CVD·대비 검증 통과)
const SERIES = [
  { key: "in_qty", label: "입고", color: "#2a78d6" },
  { key: "out_qty", label: "출고", color: "#eb6834" },
  { key: "return_qty", label: "반품", color: "#1baf7a" },
] as const;

const CHART_HEIGHT = 220;

/** y축 스케일: 1/2/5 × 10^n 단위의 깔끔한 눈금 값들과 상한 */
function niceScale(max: number): { yMax: number; tickVals: number[] } {
  const rough = Math.max(max, 1) / 5;
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(rough, 1))));
  const step = [1, 2, 5, 10].map((m) => m * pow).find((s) => s >= rough) ?? 10 * pow;
  const yMax = Math.ceil(max / step) * step;
  const tickVals: number[] = [];
  for (let v = step; v <= yMax; v += step) tickVals.push(v);
  return { yMax, tickVals };
}

/** 최근 N개월 'YYYY-MM' 목록 */
function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const m = new Date(d.getFullYear(), d.getMonth() - i, 1);
    out.push(`${m.getFullYear()}-${String(m.getMonth() + 1).padStart(2, "0")}`);
  }
  return out;
}

export default function MonthlyChart({ rows }: { rows: MonthlyRow[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const months = useMemo(() => {
    const byMonth = new Map(rows.map((r) => [r.month, r]));
    return lastMonths(12).map(
      (month) => byMonth.get(month) ?? { month, in_qty: 0, out_qty: 0, return_qty: 0 }
    );
  }, [rows]);

  const maxVal = Math.max(...months.flatMap((m) => [m.in_qty, m.out_qty, m.return_qty]));
  const { yMax, tickVals } = niceScale(maxVal);

  if (maxVal === 0) {
    return <p className="text-sm text-gray-500">최근 12개월 입출고 내역이 없습니다.</p>;
  }

  const fmtMonth = (m: string) => `${m.slice(2, 4)}.${m.slice(5, 7)}`;

  return (
    <div>
      {/* 범례 */}
      <div className="flex gap-4 mb-3">
        {SERIES.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5 text-xs text-gray-600">
            <span className="inline-block w-2.5 h-2.5 rounded-[2px]" style={{ background: s.color }} />
            {s.label}
          </span>
        ))}
      </div>

      <div className="flex">
        {/* y축 눈금 */}
        <div className="relative w-12 shrink-0 text-right pr-2" style={{ height: CHART_HEIGHT }}>
          {tickVals.map((v) => (
            <span
              key={v}
              className="absolute right-2 -translate-y-1/2 text-[11px] text-[#898781] tabular-nums"
              style={{ top: CHART_HEIGHT * (1 - v / yMax) }}
            >
              {v.toLocaleString()}
            </span>
          ))}
          <span className="absolute right-2 bottom-0 translate-y-1/2 text-[11px] text-[#898781] tabular-nums">
            0
          </span>
        </div>

        {/* 차트 영역 */}
        <div className="relative flex-1" style={{ height: CHART_HEIGHT }}>
          {/* 그리드라인 (헤어라인) */}
          {tickVals.map((v) => (
            <div
              key={v}
              className="absolute inset-x-0 h-px bg-[#e1e0d9]"
              style={{ top: CHART_HEIGHT * (1 - v / yMax) }}
            />
          ))}
          {/* 베이스라인 */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-[#c3c2b7]" />

          {/* 월별 그룹 */}
          <div className="absolute inset-0 flex">
            {months.map((m, i) => (
              <div
                key={m.month}
                className={`relative flex-1 flex items-end justify-center gap-[2px] ${
                  hover === i ? "bg-gray-900/[.04]" : ""
                }`}
                onMouseEnter={() => setHover(i)}
                onMouseLeave={() => setHover(null)}
              >
                {SERIES.map((s) => {
                  const v = m[s.key];
                  const h = Math.round((v / yMax) * (CHART_HEIGHT - 8));
                  return (
                    <div
                      key={s.key}
                      className="w-full max-w-[24px] rounded-t-[4px]"
                      style={{ height: Math.max(v > 0 ? 2 : 0, h), background: s.color }}
                    />
                  );
                })}

                {/* 툴팁: 해당 월의 전 시리즈 값 */}
                {hover === i && (
                  <div
                    className={`absolute bottom-full mb-2 z-10 bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 whitespace-nowrap ${
                      i < 2 ? "left-0" : i > months.length - 3 ? "right-0" : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    <div className="text-[11px] text-gray-500 mb-1">{fmtMonth(m.month)}</div>
                    {SERIES.map((s) => (
                      <div key={s.key} className="flex items-center gap-2 text-xs py-0.5">
                        <span className="inline-block w-3 h-[3px] rounded-full" style={{ background: s.color }} />
                        <span className="text-gray-500">{s.label}</span>
                        <span className="ml-auto pl-3 font-extrabold text-gray-900 tabular-nums">
                          {m[s.key].toLocaleString()}개
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* x축 라벨 */}
      <div className="flex ml-12 mt-1.5">
        {months.map((m) => (
          <span key={m.month} className="flex-1 text-center text-[11px] text-[#898781] tabular-nums">
            {fmtMonth(m.month)}
          </span>
        ))}
      </div>

      {/* 표 뷰 (접근성: 색 대비 보완) */}
      <details className="mt-4">
        <summary className="text-xs font-bold text-gray-500 cursor-pointer select-none">표로 보기</summary>
        <div className="overflow-x-auto mt-2">
          <table className="w-full text-xs min-w-[480px]">
            <thead>
              <tr className="text-left text-gray-500">
                <th className="py-1.5 px-2">월</th>
                {SERIES.map((s) => (
                  <th key={s.key} className="py-1.5 px-2 text-right">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {months.map((m) => (
                <tr key={m.month} className="border-t border-gray-100">
                  <td className="py-1.5 px-2 tabular-nums">{fmtMonth(m.month)}</td>
                  {SERIES.map((s) => (
                    <td key={s.key} className="py-1.5 px-2 text-right tabular-nums">
                      {m[s.key].toLocaleString()}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
