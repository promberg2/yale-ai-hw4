/** Client for My Account, the wishlist, and checkout (backend/account.py). */

import type { ProductSummary, StockStatus } from "../api";

export const SIZES = ["XS", "S", "M", "L", "XL", "XXL"] as const;
export type Size = (typeof SIZES)[number];

export interface Address {
  full_name: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  zip: string;
}

export interface Account {
  id: number;
  first_name: string | null;
  last_name: string | null;
  email: string;
  member_since: string;
  preferred_size: Size | null;
  shipping_address: Address | null;
  wishlist_count: number;
  order_count: number;
  lifetime_spend: number;
  chat_message_count: number;
  free_shipping_threshold: number;
}

export interface WishlistItem {
  product: ProductSummary;
  size: Size | null;
  added_at: string;
  size_quantity: number | null;
  size_status: StockStatus | null;
}

export interface OrderLine {
  product_id: string;
  name: string;
  size: string;
  unit_price: number;
  quantity: number;
  image_url: string | null;
}

export interface Order {
  order_number: string;
  status: string;
  created_at: string;
  estimated_ready: string;
  email: string;
  full_name: string;
  fulfillment: "ship" | "pickup";
  address: Address | null;
  pickup_address: string | null;
  lines: OrderLine[];
  item_count: number;
  subtotal: number;
  shipping: number;
  tax: number;
  total: number;
}

export interface CheckoutConfig {
  free_shipping_threshold: number;
  standard_shipping: number;
  sales_tax_rate: number;
  processing_days: [number, number];
  pickup_address: string;
}

export interface StockProblem {
  product_id: string;
  name: string;
  size: string;
  requested: number;
  available: number;
}

export interface CheckoutInput {
  email: string;
  full_name: string;
  fulfillment: "ship" | "pickup";
  address: Address | null;
  lines: { product_id: string; size: string; quantity: number }[];
  save_address: boolean;
}

/** Mirrors backend/account.py so the bag can show shipping before the config loads. */
export const DEFAULT_CHECKOUT: CheckoutConfig = {
  free_shipping_threshold: 75,
  standard_shipping: 7.95,
  sales_tax_rate: 0.0635,
  processing_days: [8, 10],
  pickup_address: "Campus Customs, 57 Broadway, New Haven, CT 06511",
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly problems: StockProblem[] = [],
  ) {
    super(message);
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(path, {
    credentials: "include",
    ...init,
    headers: init.body ? { "Content-Type": "application/json", ...init.headers } : init.headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => null);
    const detail = data?.detail;
    if (typeof detail === "string") throw new ApiError(detail, res.status);
    if (detail?.message) throw new ApiError(detail.message, res.status, detail.problems ?? []);
    if (Array.isArray(detail) && detail[0]?.msg) throw new ApiError(String(detail[0].msg).replace(/^Value error, /, ""), res.status);
    throw new ApiError(`Request failed (${res.status})`, res.status);
  }
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const json = (method: string, body: unknown): RequestInit => ({ method, body: JSON.stringify(body) });

export const fetchAccount = () => request<Account>("/api/me/account");
export const updateProfile = (body: { first_name: string; last_name: string; preferred_size: Size | null; shipping_address: Address | null }) =>
  request<Account>("/api/me/profile", json("PUT", body));
export const changePassword = (body: { current_password: string; new_password: string; confirm_password: string }) =>
  request<void>("/api/me/password", json("POST", body));
export const clearConciergeMemory = () => request<void>("/api/me/chat-history", { method: "DELETE" });
export const fetchRecentlyViewed = (limit = 12) => request<ProductSummary[]>(`/api/me/recently-viewed?limit=${limit}`);

export const fetchWishlist = () => request<WishlistItem[]>("/api/me/wishlist");
export const saveToWishlist = (productId: string, size: string | null = null) =>
  request<WishlistItem[]>(`/api/me/wishlist/${encodeURIComponent(productId)}`, json("PUT", { size }));
export const removeFromWishlist = (productId: string) =>
  request<WishlistItem[]>(`/api/me/wishlist/${encodeURIComponent(productId)}`, { method: "DELETE" });

export const fetchOrders = () => request<Order[]>("/api/me/orders");
export const fetchCheckoutConfig = () => request<CheckoutConfig>("/api/checkout/config");
export const placeOrder = (body: CheckoutInput) => request<Order>("/api/orders", json("POST", body));

export const formatMoney = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value);

export const formatDate = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric", year: "numeric" }) =>
  new Date(iso.length <= 10 ? `${iso}T12:00:00` : iso.replace(" ", "T") + "Z").toLocaleDateString("en-US", opts);
