// 백엔드(FastAPI) API 클라이언트 및 타입 정의
const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export type Brand = { id: number; name: string };
export type Variant = { id: number; size: string; stock: number };
export type Product = {
  id: number;
  category: "shoe" | "goods";
  name: string;
  model: string | null;
  color: string | null;
  work_type: "light" | "normal" | null;
  item_type: string | null;
  image_url: string | null;
  low_stock_threshold: number;
  brand: Brand | null;
  variants: Variant[];
};
export type Client = { id: number; name: string; contact: string | null; memo: string | null };
export type ClientPrice = { id: number; product_id: number; unit_price: number };
export type Movement = {
  id: number;
  type: "in" | "out" | "return";
  qty: number;
  unit_price: number | null;
  memo: string | null;
  created_at: string;
  variant: Variant;
  client: Client | null;
  product_id: number | null;
  product_name: string | null;
  product_model: string | null;
};
export type Dashboard = {
  total_stock: number;
  product_count: number;
  low_stock_count: number;
  today_movements: number;
};
export type OutboundRow = {
  period: string;
  product_id: number;
  product_name: string;
  product_model: string | null;
  size: string;
  qty: number;
};
export type ClientSalesRow = {
  client_id: number;
  client_name: string;
  out_qty: number;
  return_qty: number;
  sales_amount: number;
};

export const MOVE_LABEL: Record<Movement["type"], string> = {
  in: "입고",
  out: "출고",
  return: "반품",
};
export const WORK_TYPE_LABEL: Record<string, string> = {
  light: "경작업용",
  normal: "보통작업용",
};
export const SHOE_SIZES = Array.from({ length: 15 }, (_, i) => String(230 + i * 5));
export const GOODS_SIZES = ["S", "M", "L"];

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
    cache: "no-store",
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      if (body?.detail) detail = typeof body.detail === "string" ? body.detail : JSON.stringify(body.detail);
    } catch {
      /* JSON 아님 */
    }
    throw new Error(detail);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}

export function productLabel(p: { model?: string | null; name: string }) {
  return p.model ? `${p.model} · ${p.name}` : p.name;
}
export function won(n: number) {
  return n.toLocaleString("ko-KR") + "원";
}
