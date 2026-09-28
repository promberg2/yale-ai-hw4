import { Link } from "react-router-dom";
import { displayName, formatPrice, type ProductSummary } from "../api";
import { swatch, titleCase } from "../lib/colors";
import QuickAdd from "./QuickAdd";
import WishlistButton from "./WishlistButton";

function badgeFor(p: ProductSummary): string | null {
  if (p.price >= 88) return "Premium";
  if (p.sizes_available <= 3) return "Few sizes left";
  if (p.total_stock <= 40) return "Low stock";
  return null;
}

export default function ProductCard({ product, index = 0 }: { product: ProductSummary; index?: number }) {
  const badge = badgeFor(product);
  const colors = product.colors.slice(0, 4);

  return (
    <Link
      to={`/products/${product.id}`}
      className="card reveal"
      style={{ transitionDelay: `${Math.min(index % 8, 7) * 55}ms` }}
    >
      <div className="card__media">
        <img src={product.image_url} alt={product.name} loading="lazy" />
        {badge && <span className={`card__badge ${badge === "Premium" ? "card__badge--dark" : ""}`}>{badge}</span>}
        <WishlistButton product={product} />
        {product.total_stock > 0 && <QuickAdd product={product} />}
      </div>
      <div className="card__body">
        <div className="card__meta">
          <span className="card__cat">{product.category}</span>
          {colors.length > 0 && (
            <span className="card__swatches" aria-label={`Colors: ${product.colors.join(", ")}`}>
              {colors.map((c) => (
                <span key={c} className="swatch-dot" style={{ background: swatch(c) }} title={titleCase(c)} />
              ))}
            </span>
          )}
        </div>
        <h3 className="card__name">{displayName(product.name)}</h3>
        <p className="card__desc">{product.short_description}</p>
        <div className="card__price">{formatPrice(product.price)}</div>
      </div>
    </Link>
  );
}

export function ProductCardSkeleton() {
  return (
    <div className="card card--skeleton" aria-hidden="true">
      <div className="card__media shimmer" />
      <div className="card__body">
        <div className="shimmer line line--sm" />
        <div className="shimmer line" />
        <div className="shimmer line line--md" />
      </div>
    </div>
  );
}
