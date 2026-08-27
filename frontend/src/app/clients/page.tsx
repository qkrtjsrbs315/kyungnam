"use client";

import { useCallback, useEffect, useState } from "react";
import { api, Client, ClientPrice, ClientSalesRow, Product, productLabel, won } from "@/lib/api";

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [sales, setSales] = useState<ClientSalesRow[]>([]);
  const [selected, setSelected] = useState<Client | null>(null);
  const [prices, setPrices] = useState<ClientPrice[]>([]);
  const [form, setForm] = useState({ name: "", contact: "", memo: "" });
  const [priceForm, setPriceForm] = useState({ product_id: "", unit_price: "" });

  const load = useCallback(() => {
    api<Client[]>("/clients").then(setClients).catch(() => {});
    api<Product[]>("/products").then(setProducts).catch(() => {});
    api<ClientSalesRow[]>("/stats/clients").then(setSales).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const loadPrices = useCallback((clientId: number) => {
    api<ClientPrice[]>(`/clients/${clientId}/prices`).then(setPrices).catch(() => setPrices([]));
  }, []);

  function select(c: Client) {
    setSelected(c);
    loadPrices(c.id);
  }

  async function addClient() {
    if (!form.name.trim()) {
      alert("거래처명을 입력해주세요.");
      return;
    }
    try {
      await api<Client>("/clients", {
        method: "POST",
        body: JSON.stringify({
          name: form.name.trim(),
          contact: form.contact.trim() || null,
          memo: form.memo.trim() || null,
        }),
      });
      setForm({ name: "", contact: "", memo: "" });
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function removeClient(c: Client) {
    if (!confirm(`'${c.name}' 거래처를 삭제할까요?`)) return;
    await api(`/clients/${c.id}`, { method: "DELETE" });
    if (selected?.id === c.id) setSelected(null);
    load();
  }

  async function setPrice() {
    if (!selected || !priceForm.product_id || priceForm.unit_price === "") {
      alert("제품과 단가를 입력해주세요.");
      return;
    }
    try {
      await api<ClientPrice>(`/clients/${selected.id}/prices`, {
        method: "PUT",
        body: JSON.stringify({
          product_id: Number(priceForm.product_id),
          unit_price: Number(priceForm.unit_price),
        }),
      });
      setPriceForm({ product_id: "", unit_price: "" });
      loadPrices(selected.id);
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const salesOf = (clientId: number) => sales.find((s) => s.client_id === clientId);
  const productOf = (id: number) => products.find((p) => p.id === id);

  const input = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white";
  const labelCls = "block text-xs text-gray-500 mb-1.5";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">거래처</h1>
        <p className="text-sm text-gray-500 mt-1">거래처별 단가와 매출을 관리합니다. 단가는 출고 시 자동 적용됩니다.</p>
      </div>

      <div className="grid lg:grid-cols-[1fr_1.1fr] gap-4 items-start">
        <div className="space-y-4">
          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-extrabold mb-3.5">거래처 등록</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>거래처명</label>
                <input className={input} placeholder="예: ○○건설" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={labelCls}>연락처</label>
                <input className={input} placeholder="예: 010-1234-5678" value={form.contact} onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>메모</label>
                <input className={input} value={form.memo} onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))} />
              </div>
            </div>
            <div className="flex justify-end mt-3">
              <button onClick={addClient} className="rounded-lg bg-gray-900 text-white px-4 py-2 font-bold text-sm">
                등록
              </button>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl p-5">
            <h3 className="font-extrabold mb-3.5">거래처 목록</h3>
            {clients.length === 0 ? (
              <p className="text-sm text-gray-500">등록된 거래처가 없습니다.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2.5 px-2">거래처</th>
                      <th className="py-2.5 px-2">연락처</th>
                      <th className="py-2.5 px-2 text-right">출고량</th>
                      <th className="py-2.5 px-2 text-right">매출액</th>
                      <th className="py-2.5 px-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((c) => {
                      const s = salesOf(c.id);
                      return (
                        <tr
                          key={c.id}
                          onClick={() => select(c)}
                          className={`border-t border-gray-100 cursor-pointer hover:bg-gray-50 ${selected?.id === c.id ? "bg-gray-50" : ""}`}
                        >
                          <td className="py-3 px-2 font-bold">{c.name}</td>
                          <td className="py-3 px-2 text-gray-500">{c.contact ?? "-"}</td>
                          <td className="py-3 px-2 text-right tabular-nums">{s ? s.out_qty.toLocaleString() + "개" : "-"}</td>
                          <td className="py-3 px-2 text-right tabular-nums">{s ? won(s.sales_amount) : "-"}</td>
                          <td className="py-3 px-2 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                removeClient(c);
                              }}
                              className="text-xs font-bold text-red-600"
                            >
                              삭제
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          {selected ? (
            <>
              <h3 className="font-extrabold mb-1">{selected.name} — 제품별 단가</h3>
              <p className="text-sm text-gray-500 mb-4">
                {(() => {
                  const s = salesOf(selected.id);
                  return s
                    ? `최근 1년 출고 ${s.out_qty.toLocaleString()}개 · 반품 ${s.return_qty.toLocaleString()}개 · 매출 ${won(s.sales_amount)}`
                    : "아직 거래 내역이 없습니다.";
                })()}
              </p>
              <div className="flex gap-2 mb-4">
                <select
                  className={input}
                  value={priceForm.product_id}
                  onChange={(e) => setPriceForm((f) => ({ ...f, product_id: e.target.value }))}
                >
                  <option value="">제품 선택</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>{productLabel(p)}</option>
                  ))}
                </select>
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="단가(원)"
                  value={priceForm.unit_price}
                  onChange={(e) => setPriceForm((f) => ({ ...f, unit_price: e.target.value }))}
                />
                <button onClick={setPrice} className="rounded-lg bg-gray-900 text-white px-4 font-bold text-sm shrink-0">
                  저장
                </button>
              </div>
              {prices.length === 0 ? (
                <p className="text-sm text-gray-500">등록된 단가가 없습니다.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-gray-500">
                      <th className="py-2.5 px-2">제품</th>
                      <th className="py-2.5 px-2 text-right">단가</th>
                    </tr>
                  </thead>
                  <tbody>
                    {prices.map((cp) => {
                      const p = productOf(cp.product_id);
                      return (
                        <tr key={cp.id} className="border-t border-gray-100">
                          <td className="py-3 px-2 font-bold">{p ? productLabel(p) : `#${cp.product_id}`}</td>
                          <td className="py-3 px-2 text-right tabular-nums">{won(cp.unit_price)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </>
          ) : (
            <p className="text-sm text-gray-500">왼쪽 목록에서 거래처를 선택하면 단가와 매출을 확인할 수 있습니다.</p>
          )}
        </div>
      </div>
    </div>
  );
}
