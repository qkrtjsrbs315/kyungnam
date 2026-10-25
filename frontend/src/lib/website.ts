import { getToken } from "./auth";

export const WEBSITE_API = process.env.NEXT_PUBLIC_WEBSITE_API_URL ?? "https://kyungnam-order-api.vercel.app";
export type WebsiteProduct = {
  id: number; name: string; inventory_product_id: number | null;
  description: string; price: number; categories: string[]; subcategory: string;
  image_url: string; image_urls: string[]; store_url: string;
  is_active: boolean; is_best: boolean; is_new: boolean; sort_order: number;
};
export type WebsiteOrder = {
  id: number; company_name: string; contact_name: string; phone: string;
  email: string; business_number: string; address: string; memo: string;
  status: string; created_at: string;
  items: { id: number; product_id: number | null; product_name: string; option: string; quantity: number }[];
};
export const ORDER_STATES: Record<string, string> = {
  pending: "접수", confirmed: "확인", shipped: "출고", done: "완료", canceled: "취소",
};
export const WEBSITE_CATEGORIES: Record<string, string> = { dial: "다이얼", lace: "끈", inch4: "4인치", inch5: "5인치" };
export const WEBSITE_SUBCATEGORIES: Record<string, string> = { nonslip: "난슬립", rubber: "러버", insulated: "절연" };

export async function websiteApi<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${getToken() ?? ""}`);
  if (!(init?.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${WEBSITE_API}/api/admin${path}`, { ...init, headers, cache: "no-store" });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    if (response.status === 401) throw new Error("로그인이 만료되었습니다. 재고관리 사이트에 다시 로그인해주세요.");
    throw new Error(typeof data.detail === "string" ? data.detail : `요청 실패 (${response.status})`);
  }
  return response.status === 204 ? undefined as T : response.json();
}

export function websiteImage(url: string) {
  return url.startsWith("/api/images/") ? `${WEBSITE_API}${url}` : url;
}
