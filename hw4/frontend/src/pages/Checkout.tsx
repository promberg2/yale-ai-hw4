import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, Navigate, useLocation, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, BagIcon, CheckIcon, ClockIcon, HeartIcon, LockIcon, PackageIcon, ShieldIcon, StoreIcon, TruckIcon } from "../components/Icons";
import FreeShippingBar from "../components/FreeShippingBar";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import {
  ApiError,
  DEFAULT_CHECKOUT,
  fetchAccount,
  fetchCheckoutConfig,
  formatDate,
  formatMoney,
  placeOrder,
  type Address,
  type CheckoutConfig,
  type Order,
  type StockProblem,
} from "../lib/account";
import { AddressFields } from "./Account";

const LAST_ORDER_KEY = "cc-last-order";
const EMPTY_ADDRESS: Address = { full_name: "", line1: "", line2: "", city: "", state: "", zip: "" };

function addBusinessDays(days: number): Date {
  const d = new Date();
  while (days > 0) {
    d.setDate(d.getDate() + 1);
    if (d.getDay() !== 0 && d.getDay() !== 6) days--;
  }
  return d;
}

export default function Checkout() {
  const { user, loading } = useAuth();
  const { items, subtotal, applyStock, clear } = useBag();
  const navigate = useNavigate();
  const [config, setConfig] = useState<CheckoutConfig>(DEFAULT_CHECKOUT);
  const [email, setEmail] = useState("");
  const [fulfillment, setFulfillment] = useState<"ship" | "pickup">("ship");
  const [address, setAddress] = useState<Address>(EMPTY_ADDRESS);
  const [saveAddress, setSaveAddress] = useState(true);
  const [hadSavedAddress, setHadSavedAddress] = useState(false);
  const [error, setError] = useState("");
  const [problems, setProblems] = useState<StockProblem[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetchCheckoutConfig().then(setConfig).catch(() => undefined);
    document.title = "Checkout · Yale Bulldog Blue";
    return () => {
      document.title = "Yale Bulldog Blue · Campus Customs";
    };
  }, []);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email);
    setAddress((a) => (a.full_name ? a : { ...a, full_name: user.name }));
    fetchAccount()
      .then((acc) => {
        if (acc.shipping_address) {
          setAddress(acc.shipping_address);
          setHadSavedAddress(true);
          setSaveAddress(false);
        }
      })
      .catch(() => undefined);
  }, [user]);

  const shipping = fulfillment === "pickup" || subtotal >= config.free_shipping_threshold ? 0 : config.standard_shipping;
  const tax = Math.round(subtotal * config.sales_tax_rate * 100) / 100;
  const total = subtotal + shipping + tax;
  const readyBy = useMemo(() => addBusinessDays(config.processing_days[1]), [config]);
  const count = items.reduce((n, i) => n + i.quantity, 0);

  if (!items.length && !busy) {
    return (
      <section className="page-state container">
        <span className="eyebrow">Checkout</span>
        <h1 className="display">Your bag is empty.</h1>
        <Link to="/products" className="btn btn--primary">
          Shop the collection
        </Link>
      </section>
    );
  }

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setProblems([]);
    if (!/\S+@\S+\.\S+/.test(email)) return setError("Please enter the email address for your receipt.");
    if (fulfillment === "ship") {
      if (!address.full_name.trim() || !address.line1.trim() || !address.city.trim()) return setError("Please complete your shipping address.");
      if (!/^[A-Za-z]{2}$/.test(address.state.trim())) return setError("Use the two-letter state code, e.g. CT.");
      if (!/^\d{5}(-\d{4})?$/.test(address.zip.trim())) return setError("Enter a 5-digit ZIP code.");
    }
    const fullName = fulfillment === "ship" ? address.full_name : address.full_name || user?.name || "";
    if (!fullName.trim()) return setError("Please enter the name for the order.");
    setBusy(true);
    try {
      const order = await placeOrder({
        email,
        full_name: fullName,
        fulfillment,
        address: fulfillment === "ship" ? address : null,
        lines: items.map((i) => ({ product_id: i.productId, size: i.size, quantity: i.quantity })),
        save_address: Boolean(user) && fulfillment === "ship" && saveAddress,
      });
      sessionStorage.setItem(LAST_ORDER_KEY, JSON.stringify(order));
      clear();
      navigate(`/order/${order.order_number}`, { replace: true, state: { order } });
    } catch (err) {
      if (err instanceof ApiError && err.problems.length) setProblems(err.problems);
      setError(err instanceof Error ? err.message : "We could not place your order. Please try again.");
      setBusy(false);
    }
  };

  return (
    <div className="checkout container">
      <nav className="crumbs" aria-label="Breadcrumb">
        <Link to="/products" className="crumbs__back">
          <ArrowLeft size={15} /> Keep shopping
        </Link>
      </nav>
      <h1 className="display checkout__title">Checkout</h1>

      <form className="checkout__grid" onSubmit={submit} noValidate>
        <div className="checkout__main">
          {!loading && !user && (
            <div className="notice">
              <HeartIcon size={18} />
              <span>Have an account? Log in to use your saved address and keep this order in your account.</span>
              <Link to="/login" state={{ from: "/checkout" }} className="link-btn">
                Log in
              </Link>
            </div>
          )}

          <section className="checkout__step">
            <h2>
              <span>1</span> Contact
            </h2>
            <div className="field">
              <input id="co-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder=" " autoComplete="email" required />
              <label htmlFor="co-email">Email for your receipt and updates</label>
            </div>
          </section>

          <section className="checkout__step">
            <h2>
              <span>2</span> Delivery
            </h2>
            <div className="choice-row" role="radiogroup" aria-label="Delivery method">
              <button type="button" role="radio" aria-checked={fulfillment === "ship"} className={`choice ${fulfillment === "ship" ? "choice--on" : ""}`} onClick={() => setFulfillment("ship")}>
                <TruckIcon size={22} />
                <span>
                  <strong>Ship to me</strong>
                  <small>{subtotal >= config.free_shipping_threshold ? "Free — your order qualifies" : `${formatMoney(config.standard_shipping)} · free over ${formatMoney(config.free_shipping_threshold)}`}</small>
                </span>
              </button>
              <button type="button" role="radio" aria-checked={fulfillment === "pickup"} className={`choice ${fulfillment === "pickup" ? "choice--on" : ""}`} onClick={() => setFulfillment("pickup")}>
                <StoreIcon size={22} />
                <span>
                  <strong>Pick up at 57 Broadway</strong>
                  <small>Free · across from campus, open 7 days</small>
                </span>
              </button>
            </div>

            {fulfillment === "ship" ? (
              <>
                <AddressFields value={address} onChange={setAddress} idPrefix="co-addr" />
                {user && (
                  <label className="check">
                    <input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} />
                    <span>{hadSavedAddress ? "Update my saved address with this one" : "Save this address to my account"}</span>
                  </label>
                )}
              </>
            ) : (
              <div className="pickup-card">
                <StoreIcon size={20} />
                <div>
                  <strong>{config.pickup_address}</strong>
                  <p>We print and prepare your order in our New Haven shop and email you the moment it is ready. Bring your order number.</p>
                  <div className="field">
                    <input id="co-pickup-name" value={address.full_name} onChange={(e) => setAddress({ ...address, full_name: e.target.value })} placeholder=" " autoComplete="name" required />
                    <label htmlFor="co-pickup-name">Name for pickup</label>
                  </div>
                </div>
              </div>
            )}
          </section>

          <section className="checkout__step">
            <h2>
              <span>3</span> Payment
            </h2>
            <div className="pay-note">
              <LockIcon size={20} />
              <div>
                <strong>No card needed in this demo store</strong>
                <p>Placing the order reserves your sizes and takes them off the shelf. No payment details are collected or stored on this site.</p>
              </div>
            </div>
          </section>
        </div>

        <aside className="checkout__summary">
          <h2>
            Order summary <span>({count})</span>
          </h2>
          <ul className="summary-lines">
            {items.map((i) => {
              const problem = problems.find((p) => p.product_id === i.productId && p.size === i.size);
              return (
                <li key={`${i.productId}-${i.size}`} className={problem ? "summary-line--problem" : ""}>
                  <div className="summary-lines__img">
                    <img src={i.imageUrl} alt="" />
                    <em>{i.quantity}</em>
                  </div>
                  <div>
                    <strong>{i.name}</strong>
                    <span>Size {i.size}</span>
                    {problem && <span className="summary-line__warn">{problem.available ? `Only ${problem.available} left` : "Just sold out"}</span>}
                  </div>
                  <b>{formatMoney(i.price * i.quantity)}</b>
                </li>
              );
            })}
          </ul>

          {problems.length > 0 && (
            <button
              type="button"
              className="btn btn--ghost btn--block"
              onClick={() => {
                problems.forEach((p) => applyStock(p.product_id, p.size, p.available));
                setProblems([]);
                setError("");
              }}
            >
              Update my bag to what is available
            </button>
          )}

          {fulfillment === "ship" && <FreeShippingBar subtotal={subtotal} threshold={config.free_shipping_threshold} />}

          <dl className="summary-totals">
            <div>
              <dt>Subtotal</dt>
              <dd>{formatMoney(subtotal)}</dd>
            </div>
            <div>
              <dt>{fulfillment === "pickup" ? "Pickup" : "Shipping"}</dt>
              <dd>{shipping ? formatMoney(shipping) : "Free"}</dd>
            </div>
            <div>
              <dt>Estimated tax (CT {(config.sales_tax_rate * 100).toFixed(2)}%)</dt>
              <dd>{formatMoney(tax)}</dd>
            </div>
            <div className="summary-totals__total">
              <dt>Total</dt>
              <dd>{formatMoney(total)}</dd>
            </div>
          </dl>

          <p className="summary-eta">
            <ClockIcon size={16} />
            <span>
              {fulfillment === "pickup" ? "Ready for pickup" : "Ships"} by about{" "}
              <strong>{readyBy.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}</strong> — every piece is printed in New Haven.
            </span>
          </p>

          {error && <p className="form__error">{error}</p>}
          <button className="btn btn--primary btn--lg btn--block" type="submit" disabled={busy}>
            {busy ? "Placing your order…" : `Place order · ${formatMoney(total)}`}
          </button>
          <ul className="summary-trust">
            <li>
              <ShieldIcon size={15} /> Officially licensed Yale apparel
            </li>
            <li>
              <PackageIcon size={15} /> Returns and exchanges accepted
            </li>
          </ul>
        </aside>
      </form>
    </div>
  );
}

export function OrderConfirmation() {
  const { number } = useParams();
  const location = useLocation();
  const { user } = useAuth();
  const order = useMemo<Order | null>(() => {
    const fromState = (location.state as { order?: Order } | null)?.order;
    if (fromState) return fromState;
    try {
      const saved = JSON.parse(sessionStorage.getItem(LAST_ORDER_KEY) ?? "null") as Order | null;
      return saved?.order_number === number ? saved : null;
    } catch {
      return null;
    }
  }, [location.state, number]);

  if (!order) return <Navigate to={user ? "/account?tab=orders" : "/"} replace />;

  return (
    <div className="confirm container">
      <div className="confirm__badge">
        <CheckIcon size={30} />
      </div>
      <span className="eyebrow">Order confirmed</span>
      <h1 className="display">Thank you, {order.full_name.split(" ")[0]}!</h1>
      <p className="confirm__lead">
        Your order <strong className="mono">{order.order_number}</strong> is in. Keep this number — we will use <strong>{order.email}</strong> for any updates.
      </p>

      <div className="confirm__grid">
        <div className="confirm__card">
          <h2>What happens next</h2>
          <ol className="confirm__steps">
            <li className="on">
              <CheckIcon size={14} /> Order received — your sizes are reserved
            </li>
            <li>
              <i /> Printed and prepared in our shop next to 57 Broadway
            </li>
            <li>
              <i />
              {order.fulfillment === "pickup"
                ? ` Ready for pickup at 57 Broadway by about ${formatDate(order.estimated_ready, { weekday: "short", month: "short", day: "numeric" })}`
                : ` Ships by about ${formatDate(order.estimated_ready, { weekday: "short", month: "short", day: "numeric" })}`}
            </li>
          </ol>
          {order.fulfillment === "ship" && order.address && (
            <p className="muted">
              <TruckIcon size={15} /> {order.address.full_name}, {order.address.line1}
              {order.address.line2 ? `, ${order.address.line2}` : ""}, {order.address.city}, {order.address.state} {order.address.zip}
            </p>
          )}
        </div>

        <div className="confirm__card">
          <h2>Your order</h2>
          <ul className="summary-lines">
            {order.lines.map((l) => (
              <li key={`${l.product_id}-${l.size}`}>
                <div className="summary-lines__img">
                  {l.image_url && <img src={l.image_url} alt="" />}
                  <em>{l.quantity}</em>
                </div>
                <div>
                  <strong>{l.name}</strong>
                  <span>Size {l.size}</span>
                </div>
                <b>{formatMoney(l.unit_price * l.quantity)}</b>
              </li>
            ))}
          </ul>
          <dl className="summary-totals">
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
            <div className="summary-totals__total">
              <dt>Total</dt>
              <dd>{formatMoney(order.total)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <div className="confirm__actions">
        {user ? (
          <Link to="/account?tab=orders" className="btn btn--primary">
            <PackageIcon size={17} /> Track it in My Account
          </Link>
        ) : (
          <Link to="/create-account" className="btn btn--primary">
            Create an account to track orders <ArrowRight size={16} />
          </Link>
        )}
        <Link to="/products" className="btn btn--ghost">
          <BagIcon size={17} /> Keep shopping
        </Link>
      </div>
    </div>
  );
}
