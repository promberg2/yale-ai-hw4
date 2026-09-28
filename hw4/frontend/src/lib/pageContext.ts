import type { BagItem } from "../context/BagContext";
import { getConciergePage } from "./conciergeResults";

/** What the customer is looking at, sent with every chat message (the `page_context` of POST /api/chat). */
export interface PageContext {
  page_type: "home" | "products" | "concierge_results" | "product" | "about" | "login" | "create_account" | "other";
  path: string;
  product_id?: string;
  selected_size?: string;
  category?: string;
  search?: string;
  sort?: string;
  concierge_headline?: string;
  concierge_query?: string;
  concierge_product_ids?: string[];
  bag: { product_id: string; size: string; quantity: number }[];
  recently_viewed: string[];
}

const VIEWED_KEY = "cc-recently-viewed";
const MAX_VIEWED = 10;

let selectedSize: { productId: string; size: string } | null = null;

/** The product page reports the size the customer picked, so "is it in stock?" means that size. */
export function setSelectedSize(productId: string, size: string | null): void {
  selectedSize = size ? { productId, size } : null;
}

export function getRecentlyViewed(): string[] {
  try {
    return JSON.parse(sessionStorage.getItem(VIEWED_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** This visit's viewing trail. Signed-in customers' views are also saved on the server (POST /api/me/views). */
export function rememberView(productId: string, signedIn: boolean): void {
  const list = [productId, ...getRecentlyViewed().filter((id) => id !== productId)].slice(0, MAX_VIEWED);
  sessionStorage.setItem(VIEWED_KEY, JSON.stringify(list));
  if (signedIn) {
    void fetch("/api/me/views", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ product_id: productId }),
    }).catch(() => undefined);
  }
}

export function buildPageContext(pathname: string, search: string, bag: BagItem[]): PageContext {
  const params = new URLSearchParams(search);
  const ctx: PageContext = {
    page_type: "other",
    path: (pathname + search).slice(0, 200),
    bag: bag.map((i) => ({ product_id: i.productId, size: i.size, quantity: i.quantity })),
    recently_viewed: getRecentlyViewed(),
  };

  if (pathname === "/") ctx.page_type = "home";
  else if (pathname === "/about") ctx.page_type = "about";
  else if (pathname === "/login") ctx.page_type = "login";
  else if (pathname === "/create-account") ctx.page_type = "create_account";
  else if (pathname.startsWith("/products/")) {
    ctx.page_type = "product";
    ctx.product_id = decodeURIComponent(pathname.slice("/products/".length));
    if (selectedSize?.productId === ctx.product_id) ctx.selected_size = selectedSize.size;
  } else if (pathname === "/products") {
    const concierge = params.get("concierge");
    const page = concierge ? getConciergePage(concierge) : null;
    if (page) {
      ctx.page_type = "concierge_results";
      ctx.concierge_headline = page.headline;
      ctx.concierge_query = page.query;
      ctx.concierge_product_ids = page.products.map((p) => p.id);
    } else {
      ctx.page_type = "products";
      ctx.category = params.get("category") ?? undefined;
      ctx.search = params.get("q") ?? undefined;
    }
    ctx.sort = params.get("sort") ?? undefined;
  }
  return ctx;
}
