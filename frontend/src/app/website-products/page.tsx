"use client";

import WebsiteImagesEditor from "@/components/WebsiteImagesEditor";
import { useCallback, useEffect, useState } from "react";
import { api, Product, productImageSrc, productLabel } from "@/lib/api";
import { websiteApi, websiteImage, WebsiteProduct, WEBSITE_CATEGORIES, WEBSITE_SUBCATEGORIES, syncWebsiteProducts } from "@/lib/website";

const empty = (): Omit<WebsiteProduct, "id"> => ({ name: "", inventory_product_id: null, description: "", price: 0,
  categories: [], subcategory: "", image_url: "", image_urls: [], detail_image_urls: [], store_url: "", is_active: true,
  is_best: false, is_new: false, sort_order: 0 });
const input = "w-full border border-gray-300 rounded-lg p-2.5 bg-white";
const button = "border rounded-lg px-4 py-2 bg-white disabled:opacity-50";

export default function WebsiteProductsPage() {
  const [products, setProducts] = useState<WebsiteProduct[]>([]);
  const [inventory, setInventory] = useState<Product[]>([]);
  const [editing, setEditing] = useState<number | null | undefined>(undefined);
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [warning, setWarning] = useState("");
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const p = await websiteApi<WebsiteProduct[]>("/products");
      setProducts(p); setLoaded(true);
    } catch (e) { setError((e as Error).message); }
    finally { setLoading(false); }
  }, []);
  const refreshInventory = useCallback(async () => {
    try { setInventory(await api<Product[]>("/products", { signal: AbortSignal.timeout(30000) })); }
    catch { setWarning("재고 제품 정보를 불러오지 못했습니다. 기존 홈페이지 상품은 계속 관리할 수 있습니다."); }
  }, []);
  const sync = useCallback(async () => {
    setSyncing(true); setWarning("");
    try { await syncWebsiteProducts(); await load(); await refreshInventory(); }
    catch (e) { setWarning(`재고 동기화에 실패했습니다. 기존 상품은 유지됩니다. ${(e as Error).message}`); }
    finally { setSyncing(false); }
  }, [load, refreshInventory]);
  useEffect(() => { void load(); void refreshInventory(); }, [load, refreshInventory]);

  function edit(p?: WebsiteProduct) {
    setEditing(p?.id ?? null); setForm(p ? { ...p, detail_image_urls: p.detail_image_urls ?? [] } : empty()); setError(""); setMessage("");
  }
  function importInventory(id: number | null) {
    const p = inventory.find(p => p.id === id);
    setForm(f => ({ ...f, inventory_product_id: id, ...(p ? {
      name: [p.brand?.name, productLabel(p)].filter(Boolean).join(" · "),
      image_url: productImageSrc(p) || f.image_url,
    } : {}) }));
  }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      await websiteApi(editing === null ? "/products" : `/products/${editing}`, {
        method: editing === null ? "POST" : "PUT", body: JSON.stringify(form),
      });
      setEditing(undefined); await load(); setMessage("홈페이지에 상품 정보를 반영했습니다.");
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-5">
    <div className="flex flex-wrap justify-between items-center gap-3">
      <div><h1 className="text-2xl font-extrabold">홈페이지 상품 관리</h1>
        <p className="text-sm text-gray-500 mt-1">재고관리에서 등록한 제품이 자동으로 표시됩니다. 여기서는 판매가격·설명·이미지·BEST·노출 여부를 설정합니다.</p></div>
      <div className="flex gap-2"><a className={button} href="https://kyungnam-order.vercel.app/products" target="_blank" rel="noreferrer">홈페이지 보기</a>
        <a className={button} href="/products">재고 제품 등록</a></div>
    </div>
    {error && <p role="alert" className="bg-red-50 text-red-700 p-3 rounded-lg">{error}</p>}
    {warning && <p role="alert" className="bg-amber-50 text-amber-800 p-3 rounded-lg">{warning}</p>}
    {message && <p role="status" className="bg-green-50 text-green-800 p-3 rounded-lg">{message}</p>}
    {editing !== undefined && <form onSubmit={save} className="bg-white border rounded-2xl p-5 space-y-4">
      <h2 className="font-bold text-lg">{editing === null ? "상품 등록" : "상품 수정"}</h2>
      <fieldset disabled={busy} className="space-y-4">
        <label className="block">연결할 재고 제품
          <select className={input} disabled={form.inventory_product_id !== null} value={form.inventory_product_id ?? ""} onChange={e => importInventory(e.target.value ? Number(e.target.value) : null)}>
            <option value="">연결 없음 (홈페이지 전용 상품)</option>
            {form.inventory_product_id && !inventory.some(p => p.id === form.inventory_product_id) && <option value={form.inventory_product_id}>재고 제품 #{form.inventory_product_id}</option>}
            {inventory.map(p => <option key={p.id} value={p.id} disabled={products.some(w => w.inventory_product_id === p.id && w.id !== editing)}>
              {p.brand?.name} · {productLabel(p)}{products.some(w => w.inventory_product_id === p.id && w.id !== editing) ? " (연결됨)" : ""}</option>)}
          </select>
        </label>
        {form.inventory_product_id && <button type="button" className={button} onClick={() => importInventory(form.inventory_product_id)}>재고 제품의 이름·대표 이미지 다시 가져오기</button>}
        <p className="text-xs text-gray-500">재고 제품을 선택하면 이름과 대표 이미지를 가져옵니다. 대리점가와 홈페이지 판매가격은 별도로 관리합니다.</p>
        <div className="grid md:grid-cols-2 gap-4">
          <label>홈페이지 상품명<input required className={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
          <label>판매가격 (원)<input required type="number" min="0" className={input} value={form.price} onChange={e => setForm({ ...form, price: Number(e.target.value) })} /></label>
        </div>
        <div className="flex flex-wrap gap-4">{Object.entries(WEBSITE_CATEGORIES).map(([key, label]) =>
          <label key={key}><input type="checkbox" checked={form.categories.includes(key)} onChange={e => setForm({ ...form, categories: e.target.checked ? [...form.categories, key] : form.categories.filter(c => c !== key) })} /> {label}</label>)}</div>
        <label className="block">기능 분류<select className={input} value={form.subcategory} onChange={e => setForm({ ...form, subcategory: e.target.value })}>
          <option value="">없음</option>{Object.entries(WEBSITE_SUBCATEGORIES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="block">상품 설명<textarea rows={6} className={input} value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} /></label>
        <label className="block">스마트스토어 구매 링크<input type="url" className={input} value={form.store_url} onChange={e => setForm({ ...form, store_url: e.target.value })} /></label>
        <WebsiteImagesEditor value={form} onChange={images => setForm(f => ({...f, ...images}))} onBusy={setBusy} onError={setError} />
        <div className="flex flex-wrap gap-4">{([['is_active', '홈페이지 공개'], ['is_best', 'BEST'], ['is_new', 'NEW']] as const).map(([key, label]) =>
          <label key={key}><input type="checkbox" checked={form[key]} onChange={e => setForm({ ...form, [key]: e.target.checked })} /> {label}</label>)}</div>
        <label className="block">정렬 순서<input type="number" className={input} value={form.sort_order} onChange={e => setForm({ ...form, sort_order: Number(e.target.value) })} /></label>
        <div className="flex gap-2"><button type="submit" className="bg-gray-900 text-white rounded-lg px-5 py-2">{busy ? "저장 중…" : "저장"}</button>
          <button type="button" className={button} onClick={() => setEditing(undefined)}>닫기</button></div>
      </fieldset>
    </form>}
    <div className="bg-white border rounded-2xl p-5 space-y-4">
      <div className="flex flex-wrap gap-2"><input placeholder="상품명 검색" aria-label="상품명 검색" className={input} value={query} onChange={e => setQuery(e.target.value)} /><button className={button} onClick={() => void load()} disabled={busy || loading || syncing}>목록 새로고침</button><button className={button} onClick={() => void sync()} disabled={busy || syncing || loading}>{syncing ? "재고 동기화 중…" : "재고 상품 동기화"}</button></div>
      {loading && <p role="status">상품 목록을 불러오는 중…</p>}
      {loaded && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left"><th>상품</th><th>재고 연결</th><th>판매가격</th><th>공개</th><th>관리</th></tr></thead>
        <tbody>{products.filter(p => p.name.toLowerCase().includes(query.toLowerCase())).map(p => <tr key={p.id} className="border-t">
          <td className="py-4"><div className="flex items-center gap-3">{p.image_url && <img src={websiteImage(p.image_url)} alt="" className="h-14 w-16 rounded border object-contain" loading="lazy" />}<div>{p.name}<p className="mt-1 text-xs text-gray-500">촬영 {p.image_urls.length + (p.image_url ? 1 : 0)}장 · 상세 {p.detail_image_urls?.length ?? 0}장</p></div></div></td><td>{p.inventory_product_id ? `제품 #${p.inventory_product_id}` : "홈페이지 전용"}</td><td>{p.price.toLocaleString()}원</td><td>{p.is_active ? "공개" : "비공개"}</td>
          <td><button className={button} onClick={() => edit(p)} disabled={busy}>수정</button></td></tr>)}</tbody></table>
          {!products.length && <p className="py-5">등록된 홈페이지 상품이 없습니다.</p>}</div>}
    </div>
  </div>;
}
