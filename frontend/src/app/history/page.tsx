"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, Client, MOVE_LABEL, Movement, Product, won } from "@/lib/api";

const TYPE_STYLE: Record<Movement["type"], string> = {
  in: "bg-emerald-50 text-emerald-700",
  out: "bg-red-50 text-red-600",
  return: "bg-blue-50 text-blue-700",
};

export default function HistoryPage() {
  const [moves, setMoves] = useState<Movement[]>([]);
  const [filter, setFilter] = useState<"all" | Movement["type"]>("all");
  const [clients, setClients] = useState<Client[]>([]);
  const [editing, setEditing] = useState<Movement | null>(null);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState({ type: "in" as Movement["type"], variant_id: "", qty: 1, client_id: "", unit_price: "", memo: "" });
  const [saving, setSaving] = useState(false);

  const load = useCallback(() => {
    api<Movement[]>("/movements?limit=500").then(setMoves).catch(() => {});
    api<Client[]>("/clients").then(setClients).catch(() => {});
  }, []);
  useEffect(load, [load]);

  async function openEdit(m: Movement) {
    setEditing(m);
    setEditForm({
      type: m.type,
      variant_id: String(m.variant.id),
      qty: m.qty,
      client_id: m.client ? String(m.client.id) : "",
      unit_price: m.unit_price != null ? String(m.unit_price) : "",
      memo: m.memo ?? "",
    });
    setEditProduct(null);
    if (m.product_id) {
      try {
        setEditProduct(await api<Product>(`/products/${m.product_id}`));
      } catch {
        /* 사이즈 변경 없이 수정 가능 */
      }
    }
  }

  async function saveEdit() {
    if (!editing) return;
    if (editForm.qty < 1) {
      alert("수량을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      await api<Movement>(`/movements/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          type: editForm.type,
          variant_id: Number(editForm.variant_id),
          qty: editForm.qty,
          client_id: editForm.client_id ? Number(editForm.client_id) : null,
          unit_price: editForm.unit_price !== "" ? Number(editForm.unit_price) : null,
          memo: editForm.memo.trim() || null,
        }),
      });
      setEditing(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(m: Movement) {
    const label = m.product_model ?? m.product_name ?? "";
    if (!confirm(`${label} ${m.variant.size} ${MOVE_LABEL[m.type]} ${m.qty}개 내역을 삭제할까요?\n재고가 처리 전 상태로 되돌아갑니다.`)) return;
    try {
      await api(`/movements/${m.id}`, { method: "DELETE" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

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
                  <th className="py-2.5 px-2 text-right">관리</th>
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
                    <td className="py-3 px-2 text-right whitespace-nowrap">
                      <button onClick={() => openEdit(m)} className="text-xs font-bold text-gray-600 mr-2">
                        수정
                      </button>
                      <button onClick={() => remove(m)} className="text-xs font-bold text-red-600">
                        삭제
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-lg bg-white rounded-2xl p-6 max-h-[90vh] overflow-auto">
            <h2 className="text-lg font-extrabold mb-1">내역 수정</h2>
            <p className="text-sm text-gray-500 mb-4">
              {editing.product_model ? `${editing.product_model} · ${editing.product_name}` : editing.product_name} — 저장하면
              재고가 수정 내용대로 다시 계산됩니다.
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">구분</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
                  value={editForm.type}
                  onChange={(e) => setEditForm((f) => ({ ...f, type: e.target.value as Movement["type"] }))}
                >
                  <option value="in">입고</option>
                  <option value="out">출고</option>
                  <option value="return">반품</option>
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">사이즈</label>
                {editProduct ? (
                  <select
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
                    value={editForm.variant_id}
                    onChange={(e) => setEditForm((f) => ({ ...f, variant_id: e.target.value }))}
                  >
                    {editProduct.variants.map((v) => (
                      <option key={v.id} value={v.id}>
                        {v.size} (현재 {v.stock}개)
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-gray-50"
                    value={editing.variant.size}
                    disabled
                  />
                )}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">수량</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  type="number"
                  min={1}
                  value={editForm.qty}
                  onChange={(e) => setEditForm((f) => ({ ...f, qty: Number(e.target.value) || 1 }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">거래처</label>
                <select
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white"
                  value={editForm.client_id}
                  onChange={(e) => setEditForm((f) => ({ ...f, client_id: e.target.value }))}
                >
                  <option value="">선택 안 함</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">단가 (원)</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  type="number"
                  min={0}
                  value={editForm.unit_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, unit_price: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1.5">메모</label>
                <input
                  className="w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm"
                  value={editForm.memo}
                  onChange={(e) => setEditForm((f) => ({ ...f, memo: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setEditing(null)} className="rounded-lg border border-gray-200 px-4 py-2.5 font-bold text-sm">
                취소
              </button>
              <button
                onClick={saveEdit}
                disabled={saving}
                className="rounded-lg bg-gray-900 text-white px-4 py-2.5 font-bold text-sm disabled:opacity-50"
              >
                {saving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
