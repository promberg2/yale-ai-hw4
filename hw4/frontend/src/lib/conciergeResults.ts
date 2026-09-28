import type { ProductSummary } from "../api";

/** A results page produced by the chat agent (the `page` field of POST /api/chat). */
export interface ConciergePage {
  id: string;
  headline: string;
  intro: string;
  query: string;
  products: ProductSummary[];
}

const KEY = "cc-concierge-pages";
const MAX_PAGES = 10;

function readAll(): ConciergePage[] {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) ?? "[]") as ConciergePage[];
  } catch {
    return [];
  }
}

/** Kept in sessionStorage so the results survive a reload and the browser Back button. */
export function saveConciergePage(page: ConciergePage): void {
  const pages = [page, ...readAll().filter((p) => p.id !== page.id)].slice(0, MAX_PAGES);
  sessionStorage.setItem(KEY, JSON.stringify(pages));
}

export function getConciergePage(id: string): ConciergePage | null {
  return readAll().find((p) => p.id === id) ?? null;
}

export const conciergePath = (id: string) => `/products?concierge=${encodeURIComponent(id)}`;
