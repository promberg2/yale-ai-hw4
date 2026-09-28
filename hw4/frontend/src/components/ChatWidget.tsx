import { Fragment, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { formatPrice } from "../api";
import { fetchChatHistory, streamAssistantReply, type ChatAction, type ChatMessage } from "../chat";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { useToast } from "../context/ToastContext";
import { useWishlist } from "../context/WishlistContext";
import { conciergePath } from "../lib/conciergeResults";
import { buildPageContext } from "../lib/pageContext";
import {
  ArrowRight,
  ChatIcon,
  ChevronDown,
  CrestMark,
  ExpandIcon,
  RefreshIcon,
  SendIcon,
  ShrinkIcon,
  SparkIcon,
} from "./Icons";

/** Wide enough to show the results grid and the full chat side by side. */
const DOCK_QUERY = "(min-width: 1180px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

const STORAGE_KEY = "cc-chat";
const STORAGE_OWNER_KEY = "cc-chat-owner";
const SUGGESTIONS = ["Hoodies under $70", "My residential college", "A gift for Dad", "Navy quarter-zips", "Game day tees"];

const welcome = (firstName?: string | null, returning = false): ChatMessage => ({
  id: "welcome",
  role: "assistant",
  content: returning
    ? `Welcome back, **${firstName}**! Your earlier conversation is above. What can I help you find today?`
    : `${firstName ? `Hi **${firstName}**, welcome` : "Welcome"} to **Bulldog Blue**! I'm your personal shopping concierge. I can find the right piece, check sizes and live stock, or help you pick the perfect gift. What are you looking for today?`,
  createdAt: Date.now(),
});

function renderRich(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}

const time = (ts: number) => new Date(ts).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

export default function ChatWidget() {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const wide = useMediaQuery(DOCK_QUERY);
  const [open, setOpen] = useState(false);
  const [compact, setCompact] = useState(false);

  const onResults = location.pathname === "/products" && new URLSearchParams(location.search).has("concierge");
  const onProductPage = location.pathname.startsWith("/products/");
  const { items: bag, add: addToBag, open: openBag } = useBag();
  const { refresh: refreshWishlist } = useWishlist();
  const toast = useToast();
  // Wide screens on a results page: chat stays full size and the page makes room beside it.
  const docked = open && onResults && wide;
  // Otherwise the chat can shrink so the page stays visible and scrollable above it.
  const isCompact = open && compact && !docked;
  // On a product page the compact chat tucks down to header + input so the size picker
  // and stock stay uncovered; asking a question reopens the conversation above it.
  const [peekAnswered, setPeekAnswered] = useState(false);
  const peek = isCompact && onProductPage && !peekAnswered;
  const [teaser, setTeaser] = useState(false);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    try {
      const saved = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? "null") as ChatMessage[] | null;
      return saved?.length ? saved : [welcome()];
    } catch {
      return [welcome()];
    }
  });

  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  // A conversation belongs to whoever was signed in when it happened: on login,
  // logout, or account switch, start fresh and restore that customer's saved chat.
  useEffect(() => {
    if (authLoading) return;
    const owner = user ? `user:${user.id}` : "guest";
    const previousOwner = sessionStorage.getItem(STORAGE_OWNER_KEY);
    sessionStorage.setItem(STORAGE_OWNER_KEY, owner);
    if (previousOwner === owner) return;

    setMessages([welcome(user?.first_name)]);
    if (!user) return;
    // Checked on arrival rather than via effect cleanup: auth can re-render with the same
    // customer mid-request, which must not discard their restored history.
    fetchChatHistory(20).then((saved) => {
      if (saved.length && sessionStorage.getItem(STORAGE_OWNER_KEY) === owner) {
        setMessages([...saved, welcome(user.first_name, true)]);
      }
    });
  }, [user, authLoading]);

  useEffect(() => {
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    // The compact chat is too short to show a whole answer, so start at the top of the newest reply.
    const all = el.querySelectorAll<HTMLElement>(".msg");
    const last = all[all.length - 1];
    if (isCompact && last?.classList.contains("msg--assistant") && !last.classList.contains("msg--pending")) {
      el.scrollTop += last.getBoundingClientRect().top - el.getBoundingClientRect().top - 10;
    }
  }, [messages, typing, draft, status, open, isCompact, peek]);

  useEffect(() => {
    document.body.classList.toggle("chat-docked", docked);
    document.body.classList.toggle("chat-compact", isCompact);
    document.body.classList.toggle("chat-open", open);
    return () => {
      document.body.classList.remove("chat-docked", "chat-compact", "chat-open");
    };
  }, [docked, isCompact, open]);

  useEffect(() => {
    if (!open) setCompact(false);
  }, [open]);

  // Opening a product while chatting shrinks the chat so the product is visible;
  // returning to results on a wide screen brings the full chat back beside them.
  const openRef = useRef(open);
  useEffect(() => {
    openRef.current = open;
  }, [open]);
  useEffect(() => {
    setPeekAnswered(false);
    if (!openRef.current) return;
    if (onProductPage) setCompact(true);
    else if (onResults && wide) setCompact(false);
  }, [location.pathname, location.search, onProductPage, onResults, wide]);

  useEffect(() => {
    if (sessionStorage.getItem("cc-chat-teased")) return;
    const t = setTimeout(() => {
      if (!sessionStorage.getItem("cc-chat-teased")) setTeaser(true);
    }, 4500);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (open) {
      setTeaser(false);
      sessionStorage.setItem("cc-chat-teased", "1");
      setTimeout(() => inputRef.current?.focus(), 320);
    }
  }, [open]);

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // The chat never closes on its own: it docks beside the results or shrinks below them.
  const showPage = (pageId: string) => {
    navigate(conciergePath(pageId));
    if (!window.matchMedia(DOCK_QUERY).matches) setCompact(true);
  };

  // The concierge's tools already checked stock; the bag lives in this browser, so the add happens here.
  const runActions = (actions: ChatAction[]) => {
    const bagAdds = actions.filter((a) => a.type === "add_to_bag" && a.size);
    for (const a of bagAdds) {
      addToBag({ productId: a.product_id, name: a.name, price: a.price, imageUrl: a.image_url, size: a.size!, quantity: a.quantity, maxQuantity: a.max_quantity ?? a.quantity });
    }
    if (bagAdds.length) {
      const a = bagAdds[0];
      toast({
        text: bagAdds.length === 1 ? `Added ${a.quantity > 1 ? `${a.quantity} × ` : ""}${a.name} (${a.size}) to your bag` : `Added ${bagAdds.length} pieces to your bag`,
        image: a.image_url,
        action: { label: "View bag", onClick: openBag },
      });
    }
    if (actions.some((a) => a.type === "save_to_wishlist")) void refreshWishlist();
  };

  const send = async (text: string) => {
    const content = text.trim();
    if (!content || typing) return;
    const userMsg: ChatMessage = { id: crypto.randomUUID(), role: "user", content, createdAt: Date.now() };
    const history = [...messages, userMsg];
    setMessages(history);
    setInput("");
    setTyping(true);
    setPeekAnswered(true);
    setStatus(null);
    setDraft("");
    try {
      const reply = await streamAssistantReply(history, buildPageContext(location.pathname, location.search, bag), {
        onStatus: setStatus,
        onReply: setDraft,
      });
      setMessages((m) => [...m, { ...reply, id: crypto.randomUUID(), createdAt: Date.now() }]);
      if (reply.actions?.length) runActions(reply.actions);
      if (reply.page) showPage(reply.page.id);
    } catch (err) {
      const detail = err instanceof Error && !err.message.startsWith("Chat request failed") ? err.message : null;
      setMessages((m) => [
        ...m,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          content: detail ?? "I'm having trouble reaching the shop right now. Please try again in a moment.",
          createdAt: Date.now(),
        },
      ]);
    } finally {
      setTyping(false);
      setStatus(null);
      setDraft("");
    }
  };

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const reset = () => setMessages([welcome(user?.first_name)]);
  const lastMessage = messages[messages.length - 1];
  const chips = typing
    ? []
    : lastMessage?.id === "welcome"
      ? SUGGESTIONS
      : lastMessage?.role === "assistant"
        ? (lastMessage.suggestions ?? [])
        : [];

  // Never cover the order button with a sales prompt.
  const inCheckout = location.pathname === "/checkout" || location.pathname.startsWith("/order/");

  return (
    <div className={`chat ${open ? "chat--open" : ""} ${isCompact ? "chat--compact" : ""} ${peek ? "chat--peek" : ""} ${docked ? "chat--docked" : ""}`}>
      {teaser && !open && !inCheckout && (
        <button className="chat__teaser" onClick={() => setOpen(true)}>
          <span className="chat__teaser-avatar">
            <CrestMark size={16} />
          </span>
          Need help finding your size or the perfect gift?
          <span
            className="chat__teaser-x"
            onClick={(e) => {
              e.stopPropagation();
              setTeaser(false);
              sessionStorage.setItem("cc-chat-teased", "1");
            }}
            aria-label="Dismiss"
          >
            ×
          </span>
        </button>
      )}

      <section className="chat__panel" aria-label="Bulldog Blue shopping concierge" aria-hidden={!open}>
        <header className="chat__head">
          <div className="chat__avatar">
            <CrestMark size={20} />
            <span className="chat__online" />
          </div>
          <div
            className="chat__title"
            onClick={isCompact ? () => (peek ? setPeekAnswered(true) : setCompact(false)) : undefined}
            role={isCompact ? "button" : undefined}
          >
            <strong>Bulldog Blue Concierge</strong>
            <span>
              {!isCompact
                ? "Online · Replies in seconds"
                : peek
                  ? "Ask about this item · Tap to see the chat"
                  : onResults
                  ? "Your results are on the page · Tap to expand"
                  : "Tap to expand the conversation"}
            </span>
          </div>
          {!docked && (
            <button
              className="chat__head-btn"
              onClick={() => setCompact((c) => !c)}
              aria-label={isCompact ? "Expand chat" : "Shrink chat to see the page"}
              title={isCompact ? "Expand chat" : "Shrink chat"}
            >
              {isCompact ? <ExpandIcon size={17} /> : <ShrinkIcon size={17} />}
            </button>
          )}
          <button className="chat__head-btn" onClick={reset} aria-label="Start a new conversation" title="New conversation">
            <RefreshIcon size={17} />
          </button>
          <button className="chat__head-btn" onClick={() => setOpen(false)} aria-label="Minimize chat" title="Minimize">
            <ChevronDown size={20} />
          </button>
        </header>

        <div className="chat__body" ref={listRef} aria-live="polite">
          <div className="chat__day">Today</div>
          {messages.map((m) => (
            <div key={m.id} className={`msg msg--${m.role}`}>
              {m.role === "assistant" && (
                <div className="msg__avatar">
                  <CrestMark size={13} />
                </div>
              )}
              <div className="msg__stack">
                <div className="msg__bubble">{renderRich(m.content)}</div>
                {m.actions && m.actions.length > 0 && (
                  <div className="msg__actions">
                    {m.actions.map((a) => (
                      <div key={`${a.type}-${a.product_id}-${a.size}`} className="action-chip">
                        <img src={a.image_url} alt="" />
                        <span>
                          <small>{a.type === "add_to_bag" ? "Added to your bag" : "Saved to your wishlist"}</small>
                          <strong>{a.name}</strong>
                          <em>
                            {[a.size && `Size ${a.size}`, a.type === "add_to_bag" && `Qty ${a.quantity}`, formatPrice(a.price)].filter(Boolean).join(" · ")}
                          </em>
                        </span>
                        {a.type === "add_to_bag" ? (
                          <button onClick={openBag}>View bag</button>
                        ) : (
                          <Link to="/account?tab=wishlist">Wishlist</Link>
                        )}
                      </div>
                    ))}
                  </div>
                )}
                {m.page && (
                  <button className="msg__page-link" onClick={() => showPage(m.page!.id)}>
                    <span>
                      <strong>{m.page.headline}</strong>
                      <small>
                        {m.page.count} {m.page.count === 1 ? "piece" : "pieces"} on the page
                      </small>
                    </span>
                    <ArrowRight size={16} />
                  </button>
                )}
                {m.products && m.products.length > 0 && (
                  <div className="msg__products">
                    {m.products.map((p) => (
                      <Link key={p.id} to={`/products/${p.id}`} className="mini-card">
                        <div className="mini-card__img">
                          <img src={p.image_url} alt={p.name} />
                        </div>
                        <div className="mini-card__name">{p.name}</div>
                        <div className="mini-card__price">
                          {formatPrice(p.price)}
                          {!p.in_stock && <span className="mini-card__out"> · Sold out</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
                <span className="msg__time">{time(m.createdAt)}</span>
              </div>
            </div>
          ))}

          {typing &&
            (draft ? (
              <div className="msg msg--assistant msg--streaming">
                <div className="msg__avatar">
                  <CrestMark size={13} />
                </div>
                <div className="msg__stack">
                  <div className="msg__bubble">
                    {renderRich((draft.match(/\*\*/g)?.length ?? 0) % 2 ? `${draft}**` : draft)}
                    <span className="msg__caret" aria-hidden="true" />
                  </div>
                </div>
              </div>
            ) : (
              <div className="msg msg--assistant msg--pending">
                <div className="msg__avatar">
                  <CrestMark size={13} />
                </div>
                <div className="msg__stack">
                  <div className="msg__bubble msg__typing">
                    <span />
                    <span />
                    <span />
                  </div>
                  {status && <span className="msg__status">{status}</span>}
                </div>
              </div>
            ))}

          {chips.length > 0 && (
            <div className="chat__suggestions">
              {chips.map((s) => (
                <button key={s} onClick={() => void send(s)}>
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="chat__foot">
          <div className="chat__input">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              placeholder="Ask about products, sizes, or gifts…"
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              aria-label="Message"
            />
            <button className="chat__send" onClick={() => void send(input)} disabled={!input.trim() || typing} aria-label="Send message">
              <SendIcon size={18} />
            </button>
          </div>
          <div className="chat__disclaimer">
            <SparkIcon size={12} /> AI concierge · Answers come from our live catalogue and stock
          </div>
        </footer>
      </section>

      <button className="chat__fab" onClick={() => setOpen((v) => !v)} aria-label={open ? "Close chat" : "Open chat"}>
        <span className="chat__fab-icon chat__fab-icon--chat">
          <ChatIcon size={26} />
        </span>
        <span className="chat__fab-icon chat__fab-icon--close">
          <ChevronDown size={26} />
        </span>
      </button>
    </div>
  );
}
