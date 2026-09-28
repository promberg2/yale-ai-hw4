import { useEffect, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { Link, useParams } from "react-router-dom";
import { displayName, fetchProduct, formatPrice, type ProductDetail, type SizeStock } from "../api";
import { ArrowLeft, BagIcon, CheckIcon, ChevronDown, MinusIcon, PlusIcon, ReturnIcon, ShieldIcon, TruckIcon } from "../components/Icons";
import ProductCard from "../components/ProductCard";
import WishlistButton from "../components/WishlistButton";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { rememberView, setSelectedSize } from "../lib/pageContext";
import { swatch, titleCase } from "../lib/colors";
import { useReveal } from "../lib/useReveal";

function stockLine(s: SizeStock | undefined, product: ProductDetail): { text: string; tone: "ok" | "low" | "out" } {
  if (!s) {
    const inStock = product.sizes.filter((x) => x.quantity > 0).length;
    return inStock
      ? { text: `In stock in ${inStock} of ${product.sizes.length} sizes — select yours below.`, tone: "ok" }
      : { text: "Currently sold out in every size.", tone: "out" };
  }
  if (s.status === "sold_out") return { text: `Size ${s.size} is sold out. Try a neighboring size.`, tone: "out" };
  if (s.status === "low_stock") return { text: `Only ${s.quantity} left in size ${s.size} — order soon.`, tone: "low" };
  return { text: `In stock — ${s.quantity} available in size ${s.size}.`, tone: "ok" };
}

function Accordion({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`acc ${open ? "acc--open" : ""}`}>
      <button className="acc__head" onClick={() => setOpen((v) => !v)} aria-expanded={open}>
        {title}
        <ChevronDown size={18} />
      </button>
      <div className="acc__body">
        <div className="acc__inner">{children}</div>
      </div>
    </div>
  );
}

export default function ProductPage() {
  const { id = "" } = useParams();
  const { add, open: openBag } = useBag();
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [status, setStatus] = useState<"loading" | "ready" | "missing" | "error">("loading");
  const [size, setSize] = useState<string | null>(null);
  const [qty, setQty] = useState(1);
  const [added, setAdded] = useState(false);
  const [sizeHint, setSizeHint] = useState(false);
  const zoomRef = useRef<HTMLDivElement>(null);
  const { user, loading: authLoading } = useAuth();
  const signedIn = Boolean(user);
  const preferredRef = useRef<string | null>(null);
  preferredRef.current = user?.preferred_size ?? null;
  const [fromProfile, setFromProfile] = useState(false);
  const buyRef = useRef<HTMLDivElement>(null);
  const sizesRef = useRef<HTMLDivElement>(null);
  const [sticky, setSticky] = useState(false);

  useEffect(() => {
    const el = buyRef.current;
    if (status !== "ready" || !el) return;
    const observer = new IntersectionObserver(([entry]) => {
      setSticky(!entry.isIntersecting && entry.boundingClientRect.top < 0);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [status, id]);

  useEffect(() => {
    if (status === "ready" && product?.id === id && !authLoading) rememberView(id, signedIn);
  }, [status, product, id, authLoading, signedIn]);

  useEffect(() => {
    setSelectedSize(id, size);
    return () => setSelectedSize(id, null);
  }, [id, size]);

  useEffect(() => {
    setStatus("loading");
    setSize(null);
    setFromProfile(false);
    setQty(1);
    setAdded(false);
    fetchProduct(id)
      .then((p) => {
        setProduct(p);
        setStatus("ready");
        const preferred = p.sizes.find((s) => s.size === preferredRef.current && s.quantity > 0);
        if (preferred) {
          setSize(preferred.size);
          setFromProfile(true);
        }
        document.title = `${p.name} · Yale Bulldog Blue`;
      })
      .catch((e: Error) => setStatus(e.message === "not_found" ? "missing" : "error"));
    return () => {
      document.title = "Yale Bulldog Blue · Campus Customs";
    };
  }, [id]);

  useReveal([product]);

  if (status === "loading") {
    return (
      <div className="pdp container">
        <div className="pdp__grid">
          <div className="pdp__media shimmer" />
          <div className="pdp__info">
            <div className="shimmer line line--sm" />
            <div className="shimmer line line--xl" />
            <div className="shimmer line line--md" />
            <div className="shimmer block" />
          </div>
        </div>
      </div>
    );
  }

  if (status !== "ready" || !product) {
    return (
      <section className="page-state container">
        <span className="eyebrow">{status === "missing" ? "Not found" : "Connection issue"}</span>
        <h1 className="display">{status === "missing" ? "We couldn't find that product." : "The shop is offline right now."}</h1>
        <Link to="/products" className="btn btn--primary">
          Browse all products
        </Link>
      </section>
    );
  }

  const selected = product.sizes.find((s) => s.size === size);
  const line = stockLine(selected, product);
  const maxQty = selected?.quantity ?? 1;

  const onZoom = (e: MouseEvent<HTMLDivElement>) => {
    const el = zoomRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty("--zx", `${((e.clientX - r.left) / r.width) * 100}%`);
    el.style.setProperty("--zy", `${((e.clientY - r.top) / r.height) * 100}%`);
  };

  const addToBag = () => {
    if (!selected) {
      if (sticky) sizesRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      setSizeHint(true);
      setTimeout(() => setSizeHint(false), 1400);
      return;
    }
    if (selected.quantity <= 0) return;
    add({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      size: selected.size,
      quantity: qty,
      maxQuantity: selected.quantity,
    });
    setAdded(true);
    setTimeout(() => {
      setAdded(false);
      openBag();
    }, 900);
  };

  return (
    <div className="pdp">
      <div className="container">
        <nav className="crumbs" aria-label="Breadcrumb">
          <Link to="/products" className="crumbs__back">
            <ArrowLeft size={15} /> Back
          </Link>
          <Link to="/">Home</Link>
          <span>/</span>
          <Link to="/products">Products</Link>
          <span>/</span>
          <Link to={`/products?category=${encodeURIComponent(product.category)}`}>{product.category}</Link>
          <span>/</span>
          <span aria-current="page">{displayName(product.name)}</span>
        </nav>

        <div className="pdp__grid">
          <div className="pdp__media-col">
            <div className="pdp__media" ref={zoomRef} onMouseMove={onZoom}>
              <img src={product.image_url} alt={product.name} />
              <span className="pdp__zoom-hint">Hover to zoom</span>
            </div>
          </div>

          <div className="pdp__info">
            <span className="eyebrow">{product.category} · Campus Customs</span>
            <h1 className="pdp__title">{displayName(product.name)}</h1>
            <div className="pdp__price-row">
              <span className="pdp__price">{formatPrice(product.price)}</span>
              <span className="pdp__licensed">
                <ShieldIcon size={15} /> Officially licensed
              </span>
            </div>

            <p className="pdp__lead">{product.description}</p>

            {product.colors.length > 0 && (
              <div className="pdp__block">
                <div className="pdp__label">
                  Colors <span>{product.colors.map(titleCase).join(" · ")}</span>
                </div>
                <div className="pdp__swatches">
                  {product.colors.map((c) => (
                    <span key={c} className="swatch" style={{ background: swatch(c) }} title={titleCase(c)} />
                  ))}
                </div>
              </div>
            )}

            <div className={`pdp__block ${sizeHint ? "pdp__block--shake" : ""}`} ref={sizesRef}>
              <div className="pdp__label">
                Size <span>{selected ? `Selected: ${selected.size}${fromProfile ? " · your saved size" : ""}` : "Select a size"}</span>
              </div>
              <div className="sizes">
                {product.sizes.map((s) => (
                  <button
                    key={s.size}
                    className={`size size--${s.status} ${size === s.size ? "size--on" : ""}`}
                    onClick={() => {
                      setSize(s.size);
                      setFromProfile(false);
                      setQty(1);
                    }}
                    disabled={s.status === "sold_out"}
                    aria-pressed={size === s.size}
                    title={s.status === "sold_out" ? "Sold out" : `${s.quantity} in stock`}
                  >
                    {s.size}
                    {s.status === "low_stock" && <i className="size__dot" />}
                  </button>
                ))}
              </div>
              <div className={`stock stock--${line.tone}`}>
                <span className="stock__dot" />
                {line.text}
              </div>
              <div className="stock-table" aria-label="Stock by size">
                {product.sizes.map((s) => (
                  <div key={s.size} className={`stock-table__cell stock-table__cell--${s.status}`}>
                    <span>{s.size}</span>
                    <b>{s.quantity > 0 ? s.quantity : "—"}</b>
                  </div>
                ))}
              </div>
            </div>

            <div className="pdp__buy" ref={buyRef}>
              <div className="stepper">
                <button onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity" disabled={qty <= 1}>
                  <MinusIcon size={16} />
                </button>
                <span>{qty}</span>
                <button
                  onClick={() => setQty((q) => Math.min(maxQty, q + 1))}
                  aria-label="Increase quantity"
                  disabled={!selected || qty >= maxQty}
                >
                  <PlusIcon size={16} />
                </button>
              </div>
              <button className={`btn btn--primary btn--lg btn--grow ${added ? "btn--success" : ""}`} onClick={addToBag}>
                {added ? (
                  <>
                    <CheckIcon size={18} /> Added to bag
                  </>
                ) : (
                  <>
                    <BagIcon size={18} /> {selected ? `Add to bag — ${formatPrice(product.price * qty)}` : "Select a size"}
                  </>
                )}
              </button>
              <WishlistButton product={product} size={size} variant="pdp" />
            </div>

            <ul className="pdp__perks">
              <li>
                <TruckIcon size={18} /> Most orders ship within 8–10 business days
              </li>
              <li>
                <ReturnIcon size={18} /> Returns and exchanges accepted
              </li>
              <li>
                <ShieldIcon size={18} /> Printed &amp; embroidered in New Haven
              </li>
            </ul>

            <div className="pdp__accs">
              <Accordion title="Product details" defaultOpen>
                <dl className="specs">
                  <div>
                    <dt>Style</dt>
                    <dd>{titleCase(product.garment_type)}</dd>
                  </div>
                  <div>
                    <dt>Category</dt>
                    <dd>{product.category}</dd>
                  </div>
                  {product.colors.length > 0 && (
                    <div>
                      <dt>Colorway</dt>
                      <dd>{product.colors.map(titleCase).join(", ")}</dd>
                    </div>
                  )}
                  <div>
                    <dt>Sizes</dt>
                    <dd>
                      {product.sizes[0]?.size}–{product.sizes[product.sizes.length - 1]?.size}
                    </dd>
                  </div>
                  <div>
                    <dt>Style no.</dt>
                    <dd className="mono">{product.id}</dd>
                  </div>
                </dl>
              </Accordion>
              <Accordion title="Shipping & returns">
                <p>
                  Processing time for most items is 8–10 business days prior to shipment. Times may vary with order volume
                  around holidays and large sitewide promotions.
                </p>
                <p>
                  We hope you love your purchase — if you don't, we accept returns and exchanges. Our team is happy to help
                  via chat or at orderdept@campuscustoms.com.
                </p>
              </Accordion>
              {product.search_tags.length > 0 && (
                <Accordion title="Style notes">
                  <div className="chip-cloud">
                    {product.search_tags.slice(0, 10).map((t) => (
                      <Link key={t} to={`/products?q=${encodeURIComponent(t.toLowerCase())}`} className="chip chip--soft">
                        {t}
                      </Link>
                    ))}
                  </div>
                </Accordion>
              )}
            </div>
          </div>
        </div>

        {product.related.length > 0 && (
          <section className="section">
            <div className="section__head reveal">
              <div>
                <span className="eyebrow">Complete the look</span>
                <h2 className="display">You may also like</h2>
              </div>
              <Link to={`/products?category=${encodeURIComponent(product.category)}`} className="text-link">
                More {product.category.toLowerCase()}
              </Link>
            </div>
            <div className="grid grid--4">
              {product.related.map((p, i) => (
                <ProductCard key={p.id} product={p} index={i} />
              ))}
            </div>
          </section>
        )}
      </div>

      <div className={`buybar ${sticky ? "buybar--on" : ""}`} aria-hidden={!sticky}>
        <img src={product.image_url} alt="" />
        <div className="buybar__info">
          <b>{displayName(product.name)}</b>
          <span>
            {formatPrice(product.price)} · {selected ? `Size ${selected.size}` : "Choose a size"}
          </span>
        </div>
        <button
          className={`btn btn--primary buybar__btn ${added ? "btn--success" : ""}`}
          onClick={addToBag}
          tabIndex={sticky ? 0 : -1}
        >
          {added ? (
            <>
              <CheckIcon size={16} /> Added
            </>
          ) : (
            <>
              <BagIcon size={16} /> {selected ? "Add to bag" : "Select size"}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
