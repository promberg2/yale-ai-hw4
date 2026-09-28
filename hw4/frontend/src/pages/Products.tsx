import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { fetchCategories, fetchProducts, type CategoryCount, type ProductSummary, type SortKey } from "../api";
import { CloseIcon, SearchIcon, SparkIcon } from "../components/Icons";
import ProductCard, { ProductCardSkeleton } from "../components/ProductCard";
import { getConciergePage } from "../lib/conciergeResults";
import { useReveal } from "../lib/useReveal";

function sortProducts(list: ProductSummary[], sort: SortKey): ProductSummary[] {
  const out = [...list];
  if (sort === "price_asc") out.sort((a, b) => a.price - b.price || a.name.localeCompare(b.name));
  if (sort === "price_desc") out.sort((a, b) => b.price - a.price || a.name.localeCompare(b.name));
  if (sort === "name") out.sort((a, b) => a.name.localeCompare(b.name));
  return out;
}

const SORTS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Featured" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "name", label: "Name: A–Z" },
];

export default function Products() {
  const [params, setParams] = useSearchParams();
  const category = params.get("category") ?? "";
  const q = params.get("q") ?? "";
  const sort = (params.get("sort") as SortKey) || "featured";
  const conciergeId = params.get("concierge");
  // "featured" keeps the concierge's own best-first order.
  const concierge = useMemo(() => (conciergeId ? getConciergePage(conciergeId) : null), [conciergeId]);

  const [search, setSearch] = useState(q);
  const [catalogue, setCatalogue] = useState<ProductSummary[]>([]);
  const [categories, setCategories] = useState<CategoryCount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const products = concierge ? sortProducts(concierge.products, sort) : catalogue;

  const update = (key: string, value: string) => {
    const next = new URLSearchParams(params);
    if (value) next.set(key, value);
    else next.delete(key);
    if (key !== "sort") next.delete("concierge");
    setParams(next, { replace: true });
  };

  useEffect(() => {
    if (conciergeId) window.scrollTo({ top: 0, behavior: "smooth" });
  }, [conciergeId]);

  useEffect(() => {
    setSearch(q);
  }, [q]);

  useEffect(() => {
    const t = setTimeout(() => {
      if (search.trim() !== q) update("q", search.trim());
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    fetchCategories().then(setCategories).catch(() => undefined);
  }, []);

  useEffect(() => {
    if (concierge) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    fetchProducts({ q: q || undefined, category: category || undefined, sort })
      .then(setCatalogue)
      .catch(() => setError("We couldn't reach the shop. Make sure the backend is running on port 8000."))
      .finally(() => setLoading(false));
  }, [q, category, sort, concierge]);

  useReveal([products, loading, conciergeId]);

  const total = useMemo(() => categories.reduce((n, c) => n + c.count, 0), [categories]);
  const heading = concierge?.headline || category || (q ? `“${q}”` : "All products");

  return (
    <div className="shop">
      <section className={`shop__hero ${concierge ? "shop__hero--concierge" : ""}`} key={conciergeId ?? "catalogue"}>
        <div className="container">
          {concierge ? (
            <span className="eyebrow shop__concierge-eyebrow">
              <SparkIcon size={13} /> Curated by your Bulldog Blue Concierge
            </span>
          ) : (
            <span className="eyebrow">Yale Bulldog Blue · The collection</span>
          )}
          <h1 className="display display--xl">{heading}</h1>
          <p className="shop__intro">
            {concierge
              ? concierge.intro
              : "Hoodies, crewnecks, tees, quarter-zips, and fleece for every corner of Yale — residential colleges, graduate schools, varsity sports, and the whole family."}
          </p>
          {concierge && (
            <div className="concierge-query">
              <span className="concierge-query__label">You asked</span>
              <span className="concierge-query__text">“{concierge.query}”</span>
            </div>
          )}
        </div>
      </section>

      <div className="filters">
        <div className="container filters__inner">
          <div className="filters__chips" role="tablist" aria-label="Categories">
            {concierge && (
              <span className="fchip fchip--on fchip--concierge">
                <SparkIcon size={13} /> Concierge picks <span>{concierge.products.length}</span>
              </span>
            )}
            <button className={`fchip ${!category && !concierge ? "fchip--on" : ""}`} onClick={() => update("category", "")}>
              All <span>{total || ""}</span>
            </button>
            {categories.map((c) => (
              <button
                key={c.name}
                className={`fchip ${category === c.name ? "fchip--on" : ""}`}
                onClick={() => update("category", category === c.name ? "" : c.name)}
              >
                {c.name} <span>{c.count}</span>
              </button>
            ))}
          </div>

          <div className="filters__tools">
            <label className="search">
              <SearchIcon size={17} />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search colleges, sports, colors…"
                aria-label="Search products"
              />
              {search && (
                <button onClick={() => setSearch("")} aria-label="Clear search">
                  <CloseIcon size={15} />
                </button>
              )}
            </label>
            <label className="select">
              <span>Sort</span>
              <select value={sort} onChange={(e) => update("sort", e.target.value === "featured" ? "" : e.target.value)}>
                {SORTS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </div>

      <section className="container shop__results">
        <div className="shop__count">
          {loading ? "Loading the collection…" : `${products.length} ${products.length === 1 ? "product" : "products"}`}
          {concierge && <span className="shop__count-note">matched by your concierge</span>}
          {(q || category || concierge) && !loading && (
            <button className="link-btn" onClick={() => setParams({}, { replace: true })}>
              {concierge ? "Back to all products" : "Clear filters"}
            </button>
          )}
        </div>

        {error ? (
          <div className="page-state">
            <p>{error}</p>
          </div>
        ) : loading ? (
          <div className="grid grid--4">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="page-state">
            <h2 className="display">Nothing matched that search.</h2>
            <p>Try a garment, a color, a residential college, or a sport.</p>
            <button className="btn btn--primary" onClick={() => setParams({}, { replace: true })}>
              Show all products
            </button>
          </div>
        ) : (
          <div className="grid grid--4">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
