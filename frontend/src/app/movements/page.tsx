"use client";

import { useEffect, useMemo, useState } from "react";
import { api, Client, ClientPrice, Movement, Product, productLabel, won } from "@/lib/api";

export default function MovementsPage() {
  const [products, setProducts] = useState<Product[]>([]);
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
    api<Product[]>("/products").then((p) => {
      setProducts(p);
      if (p.length && !p.some((x) => String(x.id) === productId)) {
        setProductId(String(p[0].id));
      }
    }).catch(() => {});
    api<Client[]>("/clients").then(setClients).catch(() => {});
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const product = useMemo(() => products.find((p) => String(p.id) === productId), [products, productId]);

  useEffect(() => {
    if (product && !product.variants.some((v) => String(v.id) === variantId)) {
      setVariantId(String(product.variants[0]?.id ?? ""));
    }
  }, [product, variantId]);

  useEffect(() => {
    if (clientId) {
      api<ClientPrice[]>(`/clients/${clientId}/prices`).then(setClientPrices).catch(() => setClientPrices([]));
    } else {
      setClientPrices([]);
    }
  }, [clientId]);

  const autoPrice = useMemo(() => {
    if (!product || !clientId) return null;
    return clientPrices.find((cp) => cp.product_id === product.id)?.unit_price ?? null;
  }, [clientPrices, product, clientId]);

  async function submit() {
    if (!variantId) {
      alert("제품을 먼저 등록해주세요.");
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
            <label className={labelCls}>제품</label>
            <select className={input} value={productId} onChange={(e) => setProductId(e.target.value)}>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  [{p.category === "shoe" ? "신발" : "용품"}] {productLabel(p)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>사이즈</label>
            <select className={input} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
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
            <select className={input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
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
            disabled={saving}
            className="rounded-lg bg-gray-900 text-white px-5 py-2.5 font-bold text-sm disabled:opacity-50"
          >
            {saving ? "처리 중..." : "재고 반영"}
          </button>
        </div>
      </div>
    </div>
  );
}
