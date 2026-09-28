export type Category = "Hoodies" | "Crewnecks" | "Tees & Tops" | "Quarter-Zips" | "Jackets & Fleece";

export type StockStatus = "in_stock" | "low_stock" | "sold_out";

export interface ProductSummary {
  id: string;
  name: string;
  category: Category;
  garment_type: string;
  short_description: string;
  price: number;
  colors: string[];
  image_url: string;
  total_stock: number;
  sizes_available: number;
}

export interface SizeStock {
  size: string;
  quantity: number;
  status: StockStatus;
}

export interface ProductDetail extends ProductSummary {
  description: string;
  search_tags: string[];
  sizes: SizeStock[];
  related: ProductSummary[];
}

export interface CategoryCount {
  name: Category;
  count: number;
  image_url: string;
}

export type SortKey = "featured" | "price_asc" | "price_desc" | "name";

export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: SortKey;
  limit?: number;
}

async function getJSON<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) {
    throw new Error(res.status === 404 ? "not_found" : `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function fetchProducts(query: ProductQuery = {}): Promise<ProductSummary[]> {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  if (query.category) params.set("category", query.category);
  if (query.sort) params.set("sort", query.sort);
  if (query.limit) params.set("limit", String(query.limit));
  const qs = params.toString();
  return getJSON(`/api/products${qs ? `?${qs}` : ""}`);
}

export function fetchProduct(id: string): Promise<ProductDetail> {
  return getJSON(`/api/products/${encodeURIComponent(id)}`);
}

export function fetchCategories(): Promise<CategoryCount[]> {
  return getJSON("/api/categories");
}

/** Customer-facing product name: tidies catalogue artefacts like "Hoodie 1" or "1 4 Zip". */
export function displayName(name: string): string {
  return name
    .replace(/\b1 4 Zip\b/i, "¼-Zip")
    .replace(/\bT Shirt\b/gi, "T-Shirt")
    .replace(/\bL S 2 0\b/, "L/S 2.0")
    .replace(/\bUa\b/, "UA")
    .replace(/\bCreqneck\b/i, "Crewneck")
    .replace(/\s+\d$/, "");
}

export const formatPrice = (value: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(value);
