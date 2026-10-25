"use client";
import { useCallback, useEffect, useState } from "react";
import { websiteApi, WebsiteOrder, WebsiteProduct, ORDER_STATES } from "@/lib/website";

export default function OrdersPage() {
  const [orders, setOrders] = useState<WebsiteOrder[]>([]);
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);
  const load = useCallback(async () => {
    setError(""); setLoading(true);
    try { const [o, p] = await Promise.all([websiteApi<WebsiteOrder[]>("/orders"), websiteApi<WebsiteProduct[]>("/products")]); setOrders(o); setProducts(p); }
    catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function update(order: WebsiteOrder, status: string) {
    if (!confirm(`발주 #${order.id} 상태를 '${ORDER_STATES[status]}'로 변경할까요?`)) return;
    setBusy(order.id); setError("");
    try { const updated = await websiteApi<WebsiteOrder>(`/orders/${order.id}`, { method: "PATCH", body: JSON.stringify({ status }) }); setOrders(all => all.map(o => o.id === updated.id ? updated : o)); }
    catch (e) { setError((e as Error).message); }
    finally { setBusy(null); }
  }
  return <div className="space-y-5">
    <div className="flex justify-between items-center"><div><h1 className="text-2xl font-extrabold">발주 문의</h1><p className="text-sm text-gray-500 mt-1">홈페이지 접수 내역입니다. 상태 변경은 재고를 차감하지 않으며, 실제 출고는 입고·출고 메뉴에 기록해주세요.</p></div>
      <button className="border rounded-lg px-4 py-2 bg-white" onClick={() => void load()} disabled={loading || busy !== null}>새로고침</button></div>
    {error && <p role="alert" className="p-3 bg-red-50 text-red-700">{error}</p>}
    <div className="flex flex-wrap gap-2">{Object.entries({ "": "전체", ...ORDER_STATES }).map(([k, v]) => <button key={k} className={`border rounded-lg px-4 py-2 ${filter === k ? "bg-gray-900 text-white" : "bg-white"}`} onClick={() => setFilter(k)}>{v} ({orders.filter(o => !k || o.status === k).length})</button>)}</div>
    {loading ? <p>불러오는 중…</p> : orders.filter(o => !filter || o.status === filter).map(o => <details key={o.id} className="border rounded-2xl bg-white p-5">
      <summary className="cursor-pointer font-bold">#{o.id} · {o.company_name} · {o.contact_name} · {ORDER_STATES[o.status]} <span className="font-normal text-sm text-gray-500">{new Date(o.created_at).toLocaleString("ko-KR")}</span></summary>
      <div className="mt-4 space-y-3"><p>연락처: {o.phone} / 이메일: {o.email || "—"}</p><p>사업자등록번호: {o.business_number || "—"}</p><p>주소: {o.address || "—"}</p>
        <div className="overflow-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>상품</th><th>옵션·사이즈</th><th>수량</th><th>연결된 재고 제품</th></tr></thead>
          <tbody>{o.items.map(item => { const p = products.find(p => p.id === item.product_id); return <tr className="border-t" key={item.id}><td className="py-3">{item.product_name}</td><td>{item.option || "—"}</td><td>{item.quantity}</td><td>{p?.inventory_product_id ? <a className="text-blue-700 underline" href="/products">제품 #{p.inventory_product_id}</a> : "미연결"}</td></tr>; })}</tbody></table></div>
        <p className="whitespace-pre-wrap">요청사항: {o.memo || "—"}</p>
        <label className="flex gap-3 items-center">처리 상태<select className="border rounded-lg p-2" value={o.status} disabled={busy !== null} onChange={e => void update(o, e.target.value)}>{Object.entries(ORDER_STATES).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      </div>
    </details>)}
    {!loading && !orders.some(o => !filter || o.status === filter) && <p className="p-8 bg-white border rounded-2xl">해당 상태의 발주 문의가 없습니다.</p>}
  </div>;
}
