"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Brand, Client, ClientPrice, Movement, Product, productLabel, won } from "@/lib/api";

export default function MovementsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [brandId, setBrandId] = useState("");
  const [loadError, setLoadError] = useState("");
  const [clients, setClients] = useState<Client[]>([]);
  const [type, setType] = useState<"in" | "out" | "return">("in");
  const [productId, setProductId] = useState("");
  const [variantId, setVariantId] = useState("");
  const [qty, setQty] = useState(1);
  const [clientId, setClientId] = useState("");
  const [unitPrice, setUnitPrice] = useState("");
  const [clientPrices, setClientPrices] = useState<ClientPrice[]>([]);
  const [memo, setMemo] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  function load() {
    Promise.all([api<Product[]>("/products"), api<Brand[]>("/brands")])
      .then(([p, b]) => { setProducts(p); setBrands(b); setLoadError(""); })
      .catch((e: Error) => setLoadError(e.message));
    api<Client[]>("/clients").then(setClients).catch(() => {});
  }
  useEffect(load, []);

  const filteredProducts = useMemo(() => products.filter((p) =>
    brandId === "unassigned" ? !p.brand : String(p.brand?.id) === brandId
  ), [products, brandId]);
  const product = filteredProducts.find((p) => String(p.id) === productId);
  const selectedVariant = product?.variants.find((v) => String(v.id) === variantId);

  useEffect(() => {
    let active = true;
    if (clientId) {
      api<ClientPrice[]>(`/clients/${clientId}/prices`)
        .then((prices) => { if (active) setClientPrices(prices); })
        .catch(() => { if (active) setClientPrices([]); });
    }
    return () => { active = false; };
  }, [clientId]);

  const autoPrice = useMemo(() => {
    if (!product || !clientId) return null;
    return clientPrices.find((cp) => cp.product_id === product.id)?.unit_price ?? null;
  }, [clientPrices, product, clientId]);

  async function submit() {
    if (!selectedVariant) {
      alert("브랜드, 제품과 사이즈를 선택해주세요.");
      return;
    }
    if (qty < 1) {
      alert("수량을 입력해주세요.");
      return;
    }
    setSaving(true);
    setMessage("");
    try {
      const m = await api<Movement>("/movements", {
        method: "POST",
        body: JSON.stringify({
          type,
          variant_id: Number(variantId),
          qty,
          client_id: clientId ? Number(clientId) : null,
          unit_price: unitPrice !== "" ? Number(unitPrice) : null,
          memo: memo.trim() || null,
        }),
      });
      setMessage(
        `재고에 반영했습니다. ${m.product_model ?? m.product_name} ${m.variant.size} → 현재 ${m.variant.stock}개` +
          (m.unit_price != null ? ` (단가 ${won(m.unit_price)})` : "")
      );
      setQty(1);
      setMemo("");
      setUnitPrice("");
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const input = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white";
  const labelCls = "block text-xs text-gray-500 mb-1.5";

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-extrabold">입고·출고·반품 등록</h1>
        <p className="text-sm text-gray-500 mt-1">처리 즉시 현재 재고에 반영됩니다. 반품은 재고가 다시 늘어납니다.</p>
      </div>

      {loadError && <p role="alert" className="mb-4 text-red-600">{loadError}</p>}
      {message && (
        <div className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 text-emerald-800 px-4 py-3 text-sm max-w-3xl">
          {message}
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-2xl p-5 max-w-3xl">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>구분</label>
            <select className={input} value={type} onChange={(e) => setType(e.target.value as typeof type)}>
              <option value="in">입고 (재고 증가)</option>
              <option value="out">출고 (재고 감소)</option>
              <option value="return">반품 (재고 증가)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>브랜드</label>
            <select aria-label="브랜드" className={input} value={brandId} onChange={(e) => {
              setBrandId(e.target.value); setProductId(""); setVariantId(""); setUnitPrice("");
            }}>
              <option value="">브랜드 선택</option>
              {brands.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
              <option value="unassigned">브랜드 미지정 (기존 제품·용품)</option>
            </select>
          </div>
          <div>
            <label className={labelCls}>제품명</label>
            <select aria-label="제품명" className={input} value={productId} disabled={!brandId} onChange={(e) => {
              setProductId(e.target.value); setVariantId(""); setUnitPrice("");
            }}>
              <option value="">{!brandId ? "브랜드를 먼저 선택하세요" : filteredProducts.length ? "제품 선택" : "등록된 제품이 없습니다"}</option>
              {filteredProducts.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.category === "shoe" ? "신발" : "용품"}] {productLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>사이즈</label>
            <select aria-label="사이즈" disabled={!product} className={input} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
              <option value="">사이즈 선택</option>
              {product?.variants.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.size} (현재 {v.stock}개)
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>수량</label>
            <input className={input} type="number" min={1} value={qty} onChange={(e) => setQty(Number(e.target.value) || 1)} />
          </div>
          <div>
            <label className={labelCls}>거래처 (출고·반품 시 선택)</label>
            <select className={input} value={clientId} onChange={(e) => {
              setClientId(e.target.value); setClientPrices([]); setUnitPrice("");
            }}>
              <option value="">선택 안 함</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              단가 (원){autoPrice != null && ` — 미입력 시 거래처 단가 ${won(autoPrice)} 자동 적용`}
            </label>
            <input
              className={input}
              type="number"
              min={0}
              placeholder={autoPrice != null ? String(autoPrice) : "선택 입력"}
              value={unitPrice}
              onChange={(e) => setUnitPrice(e.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <label className={labelCls}>메모</label>
            <input className={input} placeholder="예: ○○건설 납품 / 생산 입고" value={memo} onChange={(e) => setMemo(e.target.value)} />
          </div>
        </div>
        <div className="flex justify-end mt-4">
          <button
            onClick={submit}
            disabled={saving || !selectedVariant}
            className="rounded-lg bg-gray-900 text-white px-5 py-2.5 font-bold text-sm disabled:opacity-50"
          >
            {saving ? "처리 중..." : "재고 반영"}
          </button>
        </div>
      </div>
    </div>
  );
}
