import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { fetchProduct, formatPrice, type ProductSummary } from "../api";
import {
  ArrowRight,
  BagIcon,
  ChatIcon,
  CheckIcon,
  ClockIcon,
  EyeIcon,
  GridIcon,
  HeartIcon,
  LockIcon,
  PackageIcon,
  StoreIcon,
  TruckIcon,
  UserIcon,
} from "../components/Icons";
import ProductCard from "../components/ProductCard";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { useToast } from "../context/ToastContext";
import { useWishlist } from "../context/WishlistContext";
import {
  SIZES,
  changePassword,
  clearConciergeMemory,
  fetchAccount,
  fetchOrders,
  fetchRecentlyViewed,
  formatDate,
  formatMoney,
  updateProfile,
  type Account as AccountData,
  type Address,
  type Order,
  type Size,
  type WishlistItem,
} from "../lib/account";
import { useReveal } from "../lib/useReveal";

type Tab = "overview" | "wishlist" | "orders" | "viewed" | "profile" | "security";

const TABS: { id: Tab; label: string; icon: ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <GridIcon size={18} /> },
  { id: "wishlist", label: "Wishlist", icon: <HeartIcon size={18} /> },
  { id: "orders", label: "Orders", icon: <PackageIcon size={18} /> },
  { id: "viewed", label: "Recently viewed", icon: <EyeIcon size={18} /> },
  { id: "profile", label: "Profile & sizes", icon: <UserIcon size={18} /> },
  { id: "security", label: "Security & privacy", icon: <LockIcon size={18} /> },
];

export default function Account() {
  const { user, loading } = useAuth();
  const [params, setParams] = useSearchParams();
  const tab = (TABS.find((t) => t.id === params.get("tab"))?.id ?? "overview") as Tab;
  const [account, setAccount] = useState<AccountData | null>(null);
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [viewed, setViewed] = useState<ProductSummary[] | null>(null);
  const { count: wishCount } = useWishlist();

  useEffect(() => {
    if (!user) return;
    fetchAccount().then(setAccount).catch(() => undefined);
    fetchOrders().then(setOrders).catch(() => setOrders([]));
    fetchRecentlyViewed(12).then(setViewed).catch(() => setViewed([]));
  }, [user, wishCount]);

  useEffect(() => {
    document.title = "My Account · Yale Bulldog Blue";
    return () => {
      document.title = "Yale Bulldog Blue · Campus Customs";
    };
  }, []);

  if (loading) return <div className="account-page container" />;
  if (!user) return <Navigate to="/login" replace state={{ from: `/account${params.toString() ? `?${params}` : ""}` }} />;

  const go = (t: Tab) => {
    setParams(t === "overview" ? {} : { tab: t });
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  };

  return (
    <div className="account-page">
      <header className="account-hero">
        <div className="container account-hero__inner">
          <div className="account-hero__avatar">{(user.first_name ?? user.name).charAt(0).toUpperCase()}</div>
          <div>
            <span className="eyebrow">My account</span>
            <h1 className="display">Hi, {user.first_name ?? user.name.split(" ")[0]}</h1>
            <p>
              {account ? `Member since ${formatDate(account.member_since, { month: "long", year: "numeric" })} · ` : ""}
              {user.email}
            </p>
          </div>
        </div>
      </header>

      <div className="container account-layout">
        <nav className="account-nav" aria-label="Account sections">
          {TABS.map((t) => (
            <button key={t.id} className={`account-nav__item ${tab === t.id ? "account-nav__item--on" : ""}`} onClick={() => go(t.id)} aria-current={tab === t.id ? "page" : undefined}>
              {t.icon}
              <span>{t.label}</span>
              {t.id === "wishlist" && wishCount > 0 && <em>{wishCount}</em>}
              {t.id === "orders" && orders && orders.length > 0 && <em>{orders.length}</em>}
            </button>
          ))}
        </nav>

        <section className="account-main">
          {tab === "overview" && <Overview account={account} orders={orders} viewed={viewed} go={go} />}
          {tab === "wishlist" && <Wishlist />}
          {tab === "orders" && <Orders orders={orders} />}
          {tab === "viewed" && <Viewed viewed={viewed} />}
          {tab === "profile" && account && <Profile account={account} onSaved={setAccount} />}
          {tab === "security" && account && <Security account={account} onCleared={() => setAccount({ ...account, chat_message_count: 0 })} />}
        </section>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ overview */

function Overview({ account, orders, viewed, go }: { account: AccountData | null; orders: Order[] | null; viewed: ProductSummary[] | null; go: (t: Tab) => void }) {
  const { items: wish } = useWishlist();
  const latest = orders?.[0];
  const lowStockSaved = wish.filter((w) => w.size_status === "low_stock");
  useReveal([viewed]);

  return (
    <div className="account-stack">
      <div className="stat-row">
        <button className="stat" onClick={() => go("orders")}>
          <PackageIcon size={20} />
          <strong>{account?.order_count ?? "–"}</strong>
          <span>Orders</span>
        </button>
        <button className="stat" onClick={() => go("wishlist")}>
          <HeartIcon size={20} />
          <strong>{wish.length}</strong>
          <span>Saved pieces</span>
        </button>
        <button className="stat" onClick={() => go("profile")}>
          <UserIcon size={20} />
          <strong>{account?.preferred_size ?? "—"}</strong>
          <span>Your size</span>
        </button>
        <div className="stat">
          <ChatIcon size={20} />
          <strong>{account?.chat_message_count ?? "–"}</strong>
          <span>Concierge messages</span>
        </div>
      </div>

      {lowStockSaved.length > 0 && (
        <div className="notice notice--warm">
          <ClockIcon size={18} />
          <span>
            <strong>Selling fast:</strong> {lowStockSaved.map((w) => `${w.product.name} (${w.size_quantity} left in ${w.size})`).join(", ")}.
          </span>
          <button className="link-btn" onClick={() => go("wishlist")}>
            View wishlist
          </button>
        </div>
      )}

      {!account?.preferred_size && (
        <div className="notice">
          <UserIcon size={18} />
          <span>Save your size once and we will pre-select it on every product page and tell the concierge.</span>
          <button className="link-btn" onClick={() => go("profile")}>
            Set my size
          </button>
        </div>
      )}

      <div className="account-card">
        <div className="account-card__head">
          <h2>Latest order</h2>
          {orders && orders.length > 0 && (
            <button className="text-link" onClick={() => go("orders")}>
              All orders
            </button>
          )}
        </div>
        {latest ? <OrderCard order={latest} compact /> : <Empty icon={<PackageIcon size={26} />} text="No orders yet. When you check out, your order and its progress will appear here." cta={{ to: "/products", label: "Start shopping" }} />}
      </div>

      <div className="account-card">
        <div className="account-card__head">
          <h2>Saved for later</h2>
          {wish.length > 0 && (
            <button className="text-link" onClick={() => go("wishlist")}>
              See all {wish.length}
            </button>
          )}
        </div>
        {wish.length ? (
          <div className="mini-grid">
            {wish.slice(0, 4).map((w) => (
              <Link key={w.product.id} to={`/products/${w.product.id}`} className="mini-tile">
                <img src={w.product.image_url} alt="" />
                <span>{w.product.name}</span>
                <b>{formatPrice(w.product.price)}</b>
              </Link>
            ))}
          </div>
        ) : (
          <Empty icon={<HeartIcon size={26} />} text="Tap the heart on any product to save it here for later." cta={{ to: "/products", label: "Browse the collection" }} />
        )}
      </div>

      {viewed && viewed.length > 0 && (
        <div className="account-card">
          <div className="account-card__head">
            <h2>Pick up where you left off</h2>
            <button className="text-link" onClick={() => go("viewed")}>
              Recently viewed
            </button>
          </div>
          <div className="mini-grid">
            {viewed.slice(0, 4).map((p) => (
              <Link key={p.id} to={`/products/${p.id}`} className="mini-tile">
                <img src={p.image_url} alt="" />
                <span>{p.name}</span>
                <b>{formatPrice(p.price)}</b>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="account-card account-card--blue">
        <div>
          <h2>Your concierge remembers you</h2>
          <p>
            Ask for gift ideas, your size in stock, or “what did I look at last week?” — it knows your saved pieces, orders, and past
            conversations.
          </p>
        </div>
        <button className="btn btn--light" onClick={() => document.querySelector<HTMLButtonElement>(".chat__fab")?.click()}>
          <ChatIcon size={18} /> Ask the concierge
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ wishlist */

function stockText(w: WishlistItem): { text: string; tone: "ok" | "low" | "out" | "none" } {
  if (!w.size) return { text: w.product.sizes_available ? `In stock in ${w.product.sizes_available} sizes` : "Sold out in every size", tone: w.product.sizes_available ? "none" : "out" };
  if (w.size_status === "sold_out") return { text: `Sold out in ${w.size}`, tone: "out" };
  if (w.size_status === "low_stock") return { text: `Only ${w.size_quantity} left in ${w.size}`, tone: "low" };
  return { text: `In stock in ${w.size}`, tone: "ok" };
}

function Wishlist() {
  const { items, remove } = useWishlist();
  const { add, open } = useBag();
  const toast = useToast();

  const ready = items.filter((w) => w.size && (w.size_quantity ?? 0) > 0);

  const moveToBag = (w: WishlistItem, quiet = false) => {
    add({ productId: w.product.id, name: w.product.name, price: w.product.price, imageUrl: w.product.image_url, size: w.size!, quantity: 1, maxQuantity: w.size_quantity! });
    if (!quiet) toast({ text: `Added ${w.product.name} (${w.size}) to your bag`, image: w.product.image_url, action: { label: "View bag", onClick: open } });
  };

  if (!items.length) {
    return (
      <div className="account-card">
        <h2>Wishlist</h2>
        <Empty icon={<HeartIcon size={30} />} text="Nothing saved yet. Tap the heart on any product — or ask the concierge to save something for you — and it will wait here with live stock." cta={{ to: "/products", label: "Browse the collection" }} />
      </div>
    );
  }

  return (
    <div className="account-stack">
      <div className="account-card account-card--flat">
        <div className="account-card__head">
          <div>
            <h2>Wishlist</h2>
            <p className="muted">
              {items.length} saved {items.length === 1 ? "piece" : "pieces"} · stock is live, so you will see when a size is running low.
            </p>
          </div>
          {ready.length > 1 && (
            <button
              className="btn btn--primary"
              onClick={() => {
                ready.forEach((w) => moveToBag(w, true));
                toast({ text: `Added ${ready.length} saved pieces to your bag`, action: { label: "View bag", onClick: open } });
              }}
            >
              <BagIcon size={17} /> Add all available to bag
            </button>
          )}
        </div>
      </div>
      <div className="wish-grid">
        {items.map((w) => {
          const s = stockText(w);
          const canAdd = Boolean(w.size && (w.size_quantity ?? 0) > 0);
          return (
            <article key={w.product.id} className="wish-card">
              <Link to={`/products/${w.product.id}`} className="wish-card__img">
                <img src={w.product.image_url} alt={w.product.name} />
              </Link>
              <div className="wish-card__body">
                <span className="card__cat">{w.product.category}</span>
                <Link to={`/products/${w.product.id}`} className="wish-card__name">
                  {w.product.name}
                </Link>
                <div className="wish-card__price">{formatPrice(w.product.price)}</div>
                <div className={`stock stock--${s.tone === "none" ? "ok" : s.tone}`}>
                  <span className="stock__dot" />
                  {s.text}
                </div>
                <small className="muted">Saved {formatDate(w.added_at, { month: "short", day: "numeric" })}</small>
                <div className="wish-card__actions">
                  {canAdd ? (
                    <button className="btn btn--primary btn--sm" onClick={() => moveToBag(w)}>
                      <BagIcon size={15} /> Add {w.size} to bag
                    </button>
                  ) : (
                    <Link to={`/products/${w.product.id}`} className="btn btn--ghost btn--sm">
                      {w.size ? "Pick another size" : "Choose a size"}
                    </Link>
                  )}
                  <button className="link-btn" onClick={() => void remove(w.product.id)}>
                    Remove
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ orders */

function OrderProgress({ order }: { order: Order }) {
  const placed = new Date(order.created_at.replace(" ", "T") + "Z");
  const ready = new Date(`${order.estimated_ready}T17:00:00`);
  const now = Date.now();
  const pct = Math.max(4, Math.min(100, ((now - placed.getTime()) / (ready.getTime() - placed.getTime())) * 100));
  const steps = ["Order placed", order.fulfillment === "pickup" ? "Printing & preparing" : "Printing & packing", order.fulfillment === "pickup" ? "Ready for pickup" : "Shipped"];
  const reached = pct >= 100 ? 3 : pct > 10 ? 2 : 1;
  return (
    <div className="progress">
      <div className="progress__bar">
        <span style={{ width: `${pct}%` }} />
      </div>
      <ol className="progress__steps">
        {steps.map((s, i) => (
          <li key={s} className={i < reached ? "on" : ""}>
            {i < reached ? <CheckIcon size={13} /> : <i />}
            {s}
          </li>
        ))}
      </ol>
    </div>
  );
}

export function OrderCard({ order, compact = false }: { order: Order; compact?: boolean }) {
  const { add, open } = useBag();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  const buyAgain = async () => {
    setBusy(true);
    let added = 0;
    const missing: string[] = [];
    for (const line of order.lines) {
      const p = await fetchProduct(line.product_id).catch(() => null);
      const stock = p?.sizes.find((s) => s.size === line.size)?.quantity ?? 0;
      if (!p || stock <= 0) {
        missing.push(`${line.name} (${line.size})`);
        continue;
      }
      add({ productId: p.id, name: p.name, price: p.price, imageUrl: p.image_url, size: line.size, quantity: Math.min(line.quantity, stock), maxQuantity: stock });
      added++;
    }
    setBusy(false);
    if (added) open();
    toast({ text: missing.length ? `Added ${added} of ${order.lines.length} pieces — sold out now: ${missing.join(", ")}` : "Your order is back in your bag" });
  };

  return (
    <article className={`order ${compact ? "order--compact" : ""}`}>
      <header className="order__head">
        <div>
          <strong className="mono">{order.order_number}</strong>
          <span>
            Placed {formatDate(order.created_at)} · {order.item_count} {order.item_count === 1 ? "item" : "items"} · {formatMoney(order.total)}
          </span>
        </div>
        <span className="order__status">
          {order.fulfillment === "pickup" ? <StoreIcon size={15} /> : <TruckIcon size={15} />}
          {order.fulfillment === "pickup" ? "Pickup" : "Shipping"} · est. {formatDate(order.estimated_ready, { month: "short", day: "numeric" })}
        </span>
      </header>
      <OrderProgress order={order} />
      <ul className="order__lines">
        {order.lines.map((l) => (
          <li key={`${l.product_id}-${l.size}`}>
            {l.image_url && <img src={l.image_url} alt="" />}
            <Link to={`/products/${l.product_id}`}>{l.name}</Link>
            <span>
              {l.size} · Qty {l.quantity}
            </span>
            <b>{formatMoney(l.unit_price * l.quantity)}</b>
          </li>
        ))}
      </ul>
      {!compact && (
        <footer className="order__foot">
          <div className="order__where">
            {order.fulfillment === "pickup" ? (
              <>
                <StoreIcon size={16} /> Pickup at {order.pickup_address}. We email {order.email} when it is ready.
              </>
            ) : (
              order.address && (
                <>
                  <TruckIcon size={16} /> Ships to {order.address.full_name}, {order.address.line1}
                  {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}, {order.address.state} {order.address.zip}
                </>
              )
            )}
          </div>
          <dl className="order__totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(order.subtotal)}</dd>
            </div>
            <div>
              <dt>{order.fulfillment === "pickup" ? "Pickup" : "Shipping"}</dt>
              <dd>{order.shipping ? formatMoney(order.shipping) : "Free"}</dd>
            </div>
            <div>
              <dt>Tax</dt>
              <dd>{formatMoney(order.tax)}</dd>
            </div>
            <div className="order__total">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
          <div className="order__actions">
            <button className="btn btn--ghost btn--sm" onClick={() => void buyAgain()} disabled={busy}>
              <BagIcon size={15} /> {busy ? "Checking stock…" : "Buy again"}
            </button>
            <a className="link-btn" href={`mailto:orderdept@campuscustoms.com?subject=Order%20${order.order_number}`}>
              Need help with this order?
            </a>
          </div>
        </footer>
      )}
    </article>
  );
}

function Orders({ orders }: { orders: Order[] | null }) {
  if (orders === null) return <div className="account-card shimmer block" />;
  if (!orders.length) {
    return (
      <div className="account-card">
        <h2>Orders</h2>
        <Empty icon={<PackageIcon size={30} />} text="You have not placed an order yet. Everything you buy while signed in shows up here, with its progress and a one-tap “Buy again”." cta={{ to: "/products", label: "Start shopping" }} />
      </div>
    );
  }
  return (
    <div className="account-stack">
      <div className="account-card account-card--flat">
        <h2>Orders</h2>
        <p className="muted">Most orders are printed in New Haven and ship or are ready for pickup within 8–10 business days.</p>
      </div>
      {orders.map((o) => (
        <OrderCard key={o.order_number} order={o} />
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ recently viewed */

function Viewed({ viewed }: { viewed: ProductSummary[] | null }) {
  useReveal([viewed]);
  if (viewed === null) return <div className="account-card shimmer block" />;
  return (
    <div className="account-stack">
      <div className="account-card account-card--flat">
        <h2>Recently viewed</h2>
        <p className="muted">The pieces you looked at while signed in, newest first — on any device.</p>
      </div>
      {viewed.length ? (
        <div className="grid grid--3">
          {viewed.map((p, i) => (
            <ProductCard key={p.id} product={p} index={i} />
          ))}
        </div>
      ) : (
        <div className="account-card">
          <Empty icon={<EyeIcon size={30} />} text="Products you open will appear here so you can find them again." cta={{ to: "/products", label: "Browse the collection" }} />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ profile */

const EMPTY_ADDRESS: Address = { full_name: "", line1: "", line2: "", city: "", state: "", zip: "" };

export function AddressFields({ value, onChange, idPrefix }: { value: Address; onChange: (a: Address) => void; idPrefix: string }) {
  const set = (k: keyof Address) => (e: { target: { value: string } }) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="form">
      <Input id={`${idPrefix}-name`} label="Full name" value={value.full_name} onChange={set("full_name")} autoComplete="name" />
      <Input id={`${idPrefix}-line1`} label="Street address" value={value.line1} onChange={set("line1")} autoComplete="address-line1" />
      <Input id={`${idPrefix}-line2`} label="Apartment, suite, college (optional)" value={value.line2} onChange={set("line2")} autoComplete="address-line2" required={false} />
      <div className="form__three">
        <Input id={`${idPrefix}-city`} label="City" value={value.city} onChange={set("city")} autoComplete="address-level2" />
        <Input id={`${idPrefix}-state`} label="State" value={value.state} onChange={set("state")} autoComplete="address-level1" maxLength={2} />
        <Input id={`${idPrefix}-zip`} label="ZIP" value={value.zip} onChange={set("zip")} autoComplete="postal-code" inputMode="numeric" maxLength={10} />
      </div>
    </div>
  );
}

function Input({ id, label, required = true, ...rest }: { id: string; label: string; required?: boolean } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="field">
      <input id={id} placeholder=" " required={required} {...rest} />
      <label htmlFor={id}>{label}</label>
    </div>
  );
}

function Profile({ account, onSaved }: { account: AccountData; onSaved: (a: AccountData) => void }) {
  const { refresh } = useAuth();
  const toast = useToast();
  const [first, setFirst] = useState(account.first_name ?? "");
  const [last, setLast] = useState(account.last_name ?? "");
  const [size, setSize] = useState<Size | null>(account.preferred_size);
  const [address, setAddress] = useState<Address>(account.shipping_address ?? EMPTY_ADDRESS);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const hasAddress = Object.entries(address).some(([k, v]) => k !== "line2" && v.trim());

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const saved = await updateProfile({ first_name: first, last_name: last, preferred_size: size, shipping_address: hasAddress ? address : null });
      onSaved(saved);
      await refresh();
      toast({ text: "Your profile is saved" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="account-stack" onSubmit={submit} noValidate>
      <div className="account-card">
        <h2>Personal details</h2>
        <div className="form">
          <div className="form__two">
            <Input id="p-first" label="First name" value={first} onChange={(e) => setFirst(e.target.value)} autoComplete="given-name" />
            <Input id="p-last" label="Last name" value={last} onChange={(e) => setLast(e.target.value)} autoComplete="family-name" />
          </div>
          <div className="field field--static">
            <input id="p-email" value={account.email} readOnly />
            <label htmlFor="p-email">Email (used to sign in)</label>
          </div>
        </div>
      </div>

      <div className="account-card">
        <h2>Your size</h2>
        <p className="muted">We pre-select it on product pages, show its live stock on your wishlist, and the concierge uses it when it recommends pieces.</p>
        <div className="sizes sizes--pick">
          {SIZES.map((s) => (
            <button type="button" key={s} className={`size ${size === s ? "size--on" : ""}`} onClick={() => setSize(size === s ? null : s)} aria-pressed={size === s}>
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="account-card">
        <h2>Default shipping address</h2>
        <p className="muted">Filled in for you at checkout. US addresses only.</p>
        <AddressFields value={address} onChange={setAddress} idPrefix="p-addr" />
      </div>

      {error && <p className="form__error">{error}</p>}
      <div>
        <button className="btn btn--primary btn--lg" type="submit" disabled={busy}>
          {busy ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}

/* ------------------------------------------------------------------ security & privacy */

function Security({ account, onCleared }: { account: AccountData; onCleared: () => void }) {
  const { logout } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return setError("Choose a new password with at least 8 characters.");
    if (next !== confirm) return setError("The new passwords do not match.");
    setError("");
    setBusy(true);
    try {
      await changePassword({ current_password: current, new_password: next, confirm_password: confirm });
      setCurrent("");
      setNext("");
      setConfirm("");
      toast({ text: "Password updated" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update your password.");
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    await clearConciergeMemory();
    sessionStorage.removeItem("cc-chat");
    sessionStorage.removeItem("cc-chat-owner");
    sessionStorage.removeItem("cc-recently-viewed");
    setConfirmClear(false);
    onCleared();
    toast({ text: "Your concierge history and browsing memory are deleted" });
  };

  return (
    <div className="account-stack">
      <form className="account-card" onSubmit={submit} noValidate>
        <h2>Change password</h2>
        <p className="muted">Passwords are stored only as a salted PBKDF2-SHA256 hash (600,000 rounds) — never in readable form.</p>
        <div className="form">
          <Input id="s-current" type="password" label="Current password" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          <div className="form__two">
            <Input id="s-new" type="password" label="New password" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
            <Input id="s-confirm" type="password" label="Confirm new password" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {error && <p className="form__error">{error}</p>}
          <div>
            <button className="btn btn--primary" type="submit" disabled={busy || !current || !next}>
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </form>

      <div className="account-card">
        <h2>Concierge memory</h2>
        <p className="muted">
          Because you are signed in, the concierge keeps your conversation ({account.chat_message_count} messages) and the products you viewed so it can pick up where you
          left off. You can erase that at any time; orders and your wishlist stay.
        </p>
        {confirmClear ? (
          <div className="confirm-row">
            <span>Delete your saved conversation and browsing history?</span>
            <button className="btn btn--danger btn--sm" onClick={() => void clear()}>
              Yes, delete
            </button>
            <button className="link-btn" onClick={() => setConfirmClear(false)}>
              Cancel
            </button>
          </div>
        ) : (
          <button className="btn btn--ghost" onClick={() => setConfirmClear(true)} disabled={account.chat_message_count === 0}>
            Clear concierge memory
          </button>
        )}
      </div>

      <div className="account-card account-card--row">
        <div>
          <h2>Sign out</h2>
          <p className="muted">Your bag stays on this device; your wishlist and orders are waiting when you sign back in.</p>
        </div>
        <button
          className="btn btn--ghost"
          onClick={async () => {
            await logout();
            navigate("/");
          }}
        >
          Sign out
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ shared */

function Empty({ icon, text, cta }: { icon: ReactNode; text: string; cta?: { to: string; label: string } }) {
  return (
    <div className="empty">
      <div className="empty__icon">{icon}</div>
      <p>{text}</p>
      {cta && (
        <Link to={cta.to} className="btn btn--primary btn--sm">
          {cta.label} <ArrowRight size={15} />
        </Link>
      )}
    </div>
  );
}
