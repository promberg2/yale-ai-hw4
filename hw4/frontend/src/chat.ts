/** Client for the Bulldog Blue Concierge — the PydanticAI agent behind POST /api/chat. */

import { saveConciergePage, type ConciergePage } from "./lib/conciergeResults";
import type { PageContext } from "./lib/pageContext";

export interface ChatProductCard {
  id: string;
  name: string;
  price: number;
  category: string;
  image_url: string;
  url: string;
  in_stock: boolean;
  sizes_available: string[];
}

/** Something the concierge did: a bag add (carried out by the browser) or a wishlist save (already stored). */
export interface ChatAction {
  type: "add_to_bag" | "save_to_wishlist";
  product_id: string;
  name: string;
  price: number;
  image_url: string;
  size: string | null;
  quantity: number;
  max_quantity: number | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  products?: ChatProductCard[];
  actions?: ChatAction[];
  suggestions?: string[];
  /** Set when this reply put a results page on the website. */
  page?: { id: string; headline: string; count: number };
  createdAt: number;
}

interface ChatResponse {
  reply: string;
  products: ChatProductCard[];
  suggestions: string[];
  page: ConciergePage | null;
  actions?: ChatAction[];
}

interface SavedMessage {
  id: number;
  role: "user" | "assistant";
  content: string;
  products: ChatProductCard[];
  created_at: string;
}

const HISTORY_TURNS = 12;

type AssistantReply = Omit<ChatMessage, "id" | "createdAt">;

export interface StreamHandlers {
  /** What the concierge is doing right now, e.g. "Checking live stock in size L…". */
  onStatus?: (text: string) => void;
  /** The answer so far, while the model is still writing it. */
  onReply?: (text: string) => void;
}

type StreamEvent =
  | { type: "status"; text: string }
  | { type: "reply"; text: string }
  | { type: "done"; response: ChatResponse };

function requestBody(history: ChatMessage[], pageContext: PageContext): string {
  const last = history[history.length - 1];
  const previous = history
    .slice(0, -1)
    .filter((m) => m.id !== "welcome")
    .slice(-HISTORY_TURNS)
    .map((m) => ({ role: m.role, content: m.content, product_ids: (m.products ?? []).map((p) => p.id) }));
  return JSON.stringify({ message: last.content, history: previous, page_context: pageContext });
}

async function failure(res: Response): Promise<Error> {
  const data = await res.json().catch(() => null);
  const detail = typeof data?.detail === "string" ? data.detail : null;
  return new Error(detail ?? `Chat request failed (${res.status})`);
}

/**
 * Streams the reply from POST /api/chat/stream so the widget can show what the concierge is
 * doing and type the answer in as it is written. Falls back to POST /api/chat if streaming
 * is unavailable before anything arrived.
 */
export async function streamAssistantReply(
  history: ChatMessage[],
  pageContext: PageContext,
  handlers: StreamHandlers = {},
): Promise<AssistantReply> {
  const body = requestBody(history, pageContext);
  let res: Response;
  try {
    res = await fetch("/api/chat/stream", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body,
    });
  } catch {
    return getAssistantReply(history, pageContext);
  }
  if (res.status === 404 || res.status === 405 || !res.body) return getAssistantReply(history, pageContext);
  if (!res.ok) throw await failure(res);

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done });
    let newline: number;
    while ((newline = buffer.indexOf("\n")) >= 0) {
      const raw = buffer.slice(0, newline).trim();
      buffer = buffer.slice(newline + 1);
      if (!raw) continue;
      const event = JSON.parse(raw) as StreamEvent;
      if (event.type === "status") handlers.onStatus?.(event.text);
      else if (event.type === "reply") handlers.onReply?.(event.text);
      else if (event.type === "done") {
        void reader.cancel();
        return toAssistantReply(event.response);
      }
    }
    if (done) break;
  }
  throw new Error("Chat request failed (stream ended early)");
}

/** Sends the new message plus the recent visible conversation, returns the agent's reply. */
export async function getAssistantReply(history: ChatMessage[], pageContext: PageContext): Promise<AssistantReply> {
  const res = await fetch("/api/chat", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: requestBody(history, pageContext),
  });
  if (!res.ok) throw await failure(res);
  return toAssistantReply((await res.json()) as ChatResponse);
}

function toAssistantReply(data: ChatResponse): AssistantReply {
  let page: ChatMessage["page"];
  if (data.page) {
    saveConciergePage(data.page);
    page = { id: data.page.id, headline: data.page.headline, count: data.page.products.length };
  }
  return { role: "assistant", content: data.reply, products: data.products, suggestions: data.suggestions, page, actions: data.actions ?? [] };
}

/** A signed-in customer's saved conversation from chat_messages (empty for guests). */
export async function fetchChatHistory(limit = 20): Promise<ChatMessage[]> {
  const res = await fetch(`/api/chat/history?limit=${limit}`, { credentials: "include" });
  if (!res.ok) return [];
  const rows = (await res.json()) as SavedMessage[];
  return rows.map((m) => ({
    id: `saved-${m.id}`,
    role: m.role,
    content: m.content,
    products: m.products,
    createdAt: new Date(m.created_at.replace(" ", "T") + "Z").getTime(),
  }));
}
