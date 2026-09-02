"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  api,
  Brand,
  downloadInventoryExcel,
  GOODS_SIZES,
  Product,
  productImageSrc,
  productLabel,
  SHOE_SIZES,
  uploadProductImage,
  WORK_TYPE_LABEL,
} from "@/lib/api";

const EMPTY_FORM = {
  category: "shoe" as "shoe" | "goods",
  name: "",
  model: "",
  color: "",
  work_type: "normal" as "light" | "normal",
  item_type: "",
  image_url: "",
  brand_id: "",
  low_stock_threshold: 10,
  base_price: "",
  memo: "",
};

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Product | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [stocks, setStocks] = useState<Record<string, number>>({});
  const [newBrand, setNewBrand] = useState("");
  const [saving, setSaving] = useState(false);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_FORM);

  const load = useCallback(() => {
    api<Product[]>("/products").then(setProducts).catch(() => {});
    api<Brand[]>("/brands").then(setBrands).catch(() => {});
  }, []);
  useEffect(load, [load]);

  const sizes = form.category === "shoe" ? SHOE_SIZES : GOODS_SIZES;
  const filtered = useMemo(() => {
    const q = query.toLowerCase();
    return products.filter((p) =>
      `${p.model ?? ""} ${p.name} ${p.color ?? ""} ${p.brand?.name ?? ""} ${p.item_type ?? ""}`
        .toLowerCase()
        .includes(q)
    );
  }, [products, query]);

  const totalOf = (p: Product) => p.variants.reduce((a, v) => a + v.stock, 0);
  const lowCount = (p: Product) => p.variants.filter((v) => v.stock <= p.low_stock_threshold).length;

  async function addBrand() {
    if (!newBrand.trim()) return;
    try {
      const b = await api<Brand>("/brands", { method: "POST", body: JSON.stringify({ name: newBrand.trim() }) });
      setBrands((prev) => [...prev, b]);
      setForm((f) => ({ ...f, brand_id: String(b.id) }));
      setNewBrand("");
    } catch (e) {
      alert((e as Error).message);
    }
  }

  async function save() {
    if (!form.name.trim()) {
      alert("제품명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const created = await api<Product>("/products", {
        method: "POST",
        body: JSON.stringify({
          category: form.category,
          name: form.name.trim(),
          model: form.model.trim() || null,
          color: form.color.trim() || null,
          work_type: form.category === "shoe" ? form.work_type : null,
          item_type: form.category === "goods" ? form.item_type.trim() || null : null,
          image_url: form.image_url.trim() || null,
          brand_id: form.category === "shoe" && form.brand_id ? Number(form.brand_id) : null,
          low_stock_threshold: form.low_stock_threshold,
          base_price: form.base_price !== "" ? Number(form.base_price) : null,
          memo: form.memo.trim() || null,
          initial_stocks: stocks,
        }),
      });
      if (imageFile) await uploadProductImage(created.id, imageFile);
      setShowModal(false);
      setForm(EMPTY_FORM);
      setStocks({});
      setImageFile(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function remove(p: Product) {
    if (!confirm(`'${productLabel(p)}' 제품을 삭제할까요?`)) return;
    await api(`/products/${p.id}`, { method: "DELETE" });
    setSelected(null);
    load();
  }

  async function changeImage(p: Product, file: File) {
    try {
      const updated = await uploadProductImage(p.id, file);
      setSelected(updated);
      load();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  function openEdit(p: Product) {
    setEditing(p);
    setEditForm({
      category: p.category,
      name: p.name,
      model: p.model ?? "",
      color: p.color ?? "",
      work_type: (p.work_type ?? "normal") as "light" | "normal",
      item_type: p.item_type ?? "",
      image_url: p.image_url ?? "",
      brand_id: p.brand ? String(p.brand.id) : "",
      low_stock_threshold: p.low_stock_threshold,
      base_price: p.base_price != null ? String(p.base_price) : "",
      memo: p.memo ?? "",
    });
  }

  async function saveEdit() {
    if (!editing) return;
    if (!editForm.name.trim()) {
      alert("제품명을 입력해주세요.");
      return;
    }
    setSaving(true);
    try {
      const updated = await api<Product>(`/products/${editing.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: editForm.name.trim(),
          model: editForm.model.trim() || null,
          color: editForm.color.trim() || null,
          work_type: editing.category === "shoe" ? editForm.work_type : null,
          item_type: editing.category === "goods" ? editForm.item_type.trim() || null : null,
          image_url: editForm.image_url.trim() || null,
          brand_id: editing.category === "shoe" && editForm.brand_id ? Number(editForm.brand_id) : null,
          low_stock_threshold: editForm.low_stock_threshold,
          base_price: editForm.base_price !== "" ? Number(editForm.base_price) : null,
          memo: editForm.memo.trim() || null,
        }),
      });
      setSelected(updated);
      setEditing(null);
      load();
    } catch (e) {
      alert((e as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function exportExcel() {
    try {
      await downloadInventoryExcel();
    } catch (e) {
      alert((e as Error).message);
    }
  }

  const input = "w-full rounded-lg border border-gray-200 px-3 py-2.5 text-sm bg-white";
  const labelCls = "block text-xs text-gray-500 mb-1.5";

  return (
    <div>
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-extrabold">제품·재고</h1>
          <p className="text-sm text-gray-500 mt-1">제품을 선택하면 사이즈별 재고를 확인할 수 있습니다.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportExcel} className="rounded-lg border border-gray-200 bg-white font-bold px-4 py-2.5">
            📊 엑셀 다운로드
          </button>
          <button onClick={() => setShowModal(true)} className="rounded-lg bg-gray-900 text-white font-bold px-4 py-2.5">
            + 제품 등록
          </button>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <input
          className={`${input} mb-3`}
          placeholder="모델명, 제품명, 브랜드, 색상 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-gray-500">
                <th className="py-2.5 px-2">구분</th>
                <th className="py-2.5 px-2">제품</th>
                <th className="py-2.5 px-2">브랜드/품목</th>
                <th className="py-2.5 px-2">색상</th>
                <th className="py-2.5 px-2">용도</th>
                <th className="py-2.5 px-2 text-right">총재고</th>
                <th className="py-2.5 px-2">부족 사이즈</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => (
                <tr
                  key={p.id}
                  onClick={() => setSelected(p)}
                  className="border-t border-gray-100 cursor-pointer hover:bg-gray-50"
                >
                  <td className="py-3 px-2">{p.category === "shoe" ? "신발" : "용품"}</td>
                  <td className="py-3 px-2 font-bold">{productLabel(p)}</td>
                  <td className="py-3 px-2">{p.category === "shoe" ? p.brand?.name ?? "-" : p.item_type ?? "-"}</td>
                  <td className="py-3 px-2">{p.color ?? "-"}</td>
                  <td className="py-3 px-2">{p.work_type ? WORK_TYPE_LABEL[p.work_type] : "-"}</td>
                  <td className="py-3 px-2 text-right tabular-nums">{totalOf(p).toLocaleString()}개</td>
                  <td className="py-3 px-2">{lowCount(p)}개</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7} className="py-6 text-center text-gray-500">
                    등록된 제품이 없습니다.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div className="bg-white border border-gray-200 rounded-2xl p-5 mt-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-extrabold text-lg">{productLabel(selected)}</h3>
            <div className="flex gap-2">
              <button
                onClick={() => openEdit(selected)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold"
              >
                제품 수정
              </button>
              <button
                onClick={() => remove(selected)}
                className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm font-bold text-red-600"
              >
                제품 삭제
              </button>
            </div>
          </div>
          <p className="text-sm text-gray-500 mb-1">
            {selected.category === "shoe"
              ? `브랜드 ${selected.brand?.name ?? "-"}`
              : `품목 ${selected.item_type ?? "-"}`}{" "}
            · 색상 {selected.color ?? "-"} · 부족재고 기준 {selected.low_stock_threshold}개 이하
            {selected.base_price != null && ` · 대리점가 ${selected.base_price.toLocaleString()}원`}
          </p>
          {selected.memo && (
            <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2 mb-3 whitespace-pre-wrap">
              📝 {selected.memo}
            </p>
          )}
          <div className="mb-3" />
          <div className="flex items-end gap-3 mb-4">
            {productImageSrc(selected) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={productImageSrc(selected)!}
                alt={selected.name}
                className="max-h-40 rounded-xl border border-gray-200"
              />
            )}
            <label className="rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-bold cursor-pointer hover:bg-gray-50">
              {productImageSrc(selected) ? "이미지 변경" : "이미지 업로드"}
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) changeImage(selected, f);
                  e.target.value = "";
                }}
              />
            </label>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[640px] w-full text-sm text-center">
              <thead>
                <tr className="text-xs text-gray-500">
                  {selected.variants.map((v) => (
                    <th key={v.id} className="py-2 px-1">{v.size}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                <tr>
                  {selected.variants.map((v) => (
                    <td key={v.id} className="py-1 px-1">
                      <span
                        className={`inline-flex px-2 py-1 rounded-full text-xs font-bold ${
                          v.stock <= selected.low_stock_threshold
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {v.stock}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-extrabold mb-4">제품 등록</h2>
            <div className="flex gap-2 mb-4">
              {(["shoe", "goods"] as const).map((c) => (
                <button
                  key={c}
                  onClick={() => {
                    setForm((f) => ({ ...f, category: c }));
                    setStocks({});
                  }}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border ${
                    form.category === c ? "bg-gray-900 text-white border-gray-900" : "border-gray-200"
                  }`}
                >
                  {c === "shoe" ? "신발" : "용품"}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {form.category === "shoe" ? (
                <>
                  <div>
                    <label className={labelCls}>브랜드</label>
                    <select
                      className={input}
                      value={form.brand_id}
                      onChange={(e) => setForm((f) => ({ ...f, brand_id: e.target.value }))}
                    >
                      <option value="">선택 안 함</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                    <div className="flex gap-1.5 mt-1.5">
                      <input
                        className={input}
                        placeholder="새 브랜드 추가"
                        value={newBrand}
                        onChange={(e) => setNewBrand(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && addBrand()}
                      />
                      <button onClick={addBrand} className="rounded-lg border border-gray-200 px-3 text-sm font-bold shrink-0">
                        추가
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className={labelCls}>작업 용도</label>
                    <select
                      className={input}
                      value={form.work_type}
                      onChange={(e) => setForm((f) => ({ ...f, work_type: e.target.value as "light" | "normal" }))}
                    >
                      <option value="light">경작업용</option>
                      <option value="normal">보통작업용</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>모델명</label>
                    <input
                      className={input}
                      placeholder="예: AW-600D"
                      value={form.model}
                      onChange={(e) => setForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>품목</label>
                  <input
                    className={input}
                    placeholder="예: 옷, 스카프"
                    value={form.item_type}
                    onChange={(e) => setForm((f) => ({ ...f, item_type: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>제품명</label>
                <input
                  className={input}
                  placeholder="예: 6인치 다이얼 안전화"
                  value={form.name}
                  onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>색상</label>
                <input
                  className={input}
                  placeholder="예: BLACK"
                  value={form.color}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>부족재고 기준</label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  value={form.low_stock_threshold}
                  onChange={(e) => setForm((f) => ({ ...f, low_stock_threshold: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className={labelCls}>대리점가 (원, 선택)</label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  placeholder="예: 33000"
                  value={form.base_price}
                  onChange={(e) => setForm((f) => ({ ...f, base_price: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>메모 (선택)</label>
                <input
                  className={input}
                  placeholder="예: 주력 상품"
                  value={form.memo}
                  onChange={(e) => setForm((f) => ({ ...f, memo: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>이미지 파일 (선택)</label>
                <input
                  className={`${input} file:mr-2 file:rounded file:border-0 file:bg-gray-100 file:px-2 file:py-1 file:text-xs file:font-bold`}
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className={labelCls}>이미지 URL (선택)</label>
                <input
                  className={input}
                  placeholder="https://..."
                  value={form.image_url}
                  onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>사이즈별 초기 재고</label>
                <div className={`grid gap-2 ${form.category === "shoe" ? "grid-cols-4 md:grid-cols-7" : "grid-cols-3"}`}>
                  {sizes.map((s) => (
                    <div key={s} className="border border-gray-200 rounded-lg p-2">
                      <span className="block text-[11px] text-gray-500 mb-1">{s}</span>
                      <input
                        type="number"
                        min={0}
                        className="w-full font-bold outline-none text-sm"
                        value={stocks[s] ?? 0}
                        onChange={(e) => setStocks((prev) => ({ ...prev, [s]: Number(e.target.value) || 0 }))}
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowModal(false)} className="rounded-lg border border-gray-200 px-4 py-2.5 font-bold text-sm">
                취소
              </button>
              <button
                onClick={save}
                disabled={saving}
                className="rounded-lg bg-gray-900 text-white px-4 py-2.5 font-bold text-sm disabled:opacity-50"
              >
                {saving ? "등록 중..." : "등록"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-slate-900/45 flex items-center justify-center p-4 z-20">
          <div className="w-full max-w-2xl bg-white rounded-2xl p-6 max-h-[90vh] overflow-auto">
            <h2 className="text-xl font-extrabold mb-4">제품 수정 — {productLabel(editing)}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {editing.category === "shoe" ? (
                <>
                  <div>
                    <label className={labelCls}>브랜드</label>
                    <select
                      className={input}
                      value={editForm.brand_id}
                      onChange={(e) => setEditForm((f) => ({ ...f, brand_id: e.target.value }))}
                    >
                      <option value="">선택 안 함</option>
                      {brands.map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>작업 용도</label>
                    <select
                      className={input}
                      value={editForm.work_type}
                      onChange={(e) => setEditForm((f) => ({ ...f, work_type: e.target.value as "light" | "normal" }))}
                    >
                      <option value="light">경작업용</option>
                      <option value="normal">보통작업용</option>
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>모델명</label>
                    <input
                      className={input}
                      value={editForm.model}
                      onChange={(e) => setEditForm((f) => ({ ...f, model: e.target.value }))}
                    />
                  </div>
                </>
              ) : (
                <div>
                  <label className={labelCls}>품목</label>
                  <input
                    className={input}
                    value={editForm.item_type}
                    onChange={(e) => setEditForm((f) => ({ ...f, item_type: e.target.value }))}
                  />
                </div>
              )}
              <div>
                <label className={labelCls}>제품명</label>
                <input
                  className={input}
                  value={editForm.name}
                  onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>색상</label>
                <input
                  className={input}
                  value={editForm.color}
                  onChange={(e) => setEditForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>부족재고 기준</label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  value={editForm.low_stock_threshold}
                  onChange={(e) => setEditForm((f) => ({ ...f, low_stock_threshold: Number(e.target.value) || 0 }))}
                />
              </div>
              <div>
                <label className={labelCls}>대리점가 (원)</label>
                <input
                  className={input}
                  type="number"
                  min={0}
                  value={editForm.base_price}
                  onChange={(e) => setEditForm((f) => ({ ...f, base_price: e.target.value }))}
                />
              </div>
              <div>
                <label className={labelCls}>이미지 URL</label>
                <input
                  className={input}
                  value={editForm.image_url}
                  onChange={(e) => setEditForm((f) => ({ ...f, image_url: e.target.value }))}
                />
              </div>
              <div className="md:col-span-2">
                <label className={labelCls}>메모</label>
                <textarea
                  className={`${input} min-h-20`}
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
