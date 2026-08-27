// 백엔드(FastAPI) API 클라이언트 및 타입 정의
export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";
const BASE = API_BASE;

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
  has_image: boolean;
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
export type MonthlyRow = {
  month: string; // '2026-08'
  in_qty: number;
  out_qty: number;
  return_qty: number;
};
export type NotificationStatus = {
  fcm_configured: boolean;
  ntfy_configured: boolean;
  token_count: number;
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

/** 제품 이미지 주소: DB 업로드 이미지 우선, 없으면 외부 URL */
export function productImageSrc(p: Product): string | null {
  if (p.has_image) return `${API_BASE}/products/${p.id}/image`;
  return p.image_url || null;
}

/** 업로드 전 클라이언트에서 리사이즈 (긴 변 maxDim, JPEG 변환) */
export function resizeImage(file: File, maxDim = 1000): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) return reject(new Error("이미지 처리에 실패했습니다."));
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => (blob ? resolve(blob) : reject(new Error("이미지 변환에 실패했습니다."))),
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("이미지를 읽을 수 없습니다."));
    };
    img.src = url;
  });
}

export async function uploadProductImage(productId: number, file: File): Promise<Product> {
  const blob = await resizeImage(file);
  const form = new FormData();
  form.append("file", blob, "product.jpg");
  const res = await fetch(`${API_BASE}/products/${productId}/image`, { method: "POST", body: form });
  if (!res.ok) throw new Error("이미지 업로드에 실패했습니다.");
  return res.json();
}
