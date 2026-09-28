import { useState, type MouseEvent } from "react";
import { useWishlist } from "../context/WishlistContext";
import { HeartIcon } from "./Icons";

interface Props {
  product: { id: string; name: string; image_url: string };
  size?: string | null;
  variant?: "card" | "pdp";
}

export default function WishlistButton({ product, size = null, variant = "card" }: Props) {
  const { has, toggle } = useWishlist();
  const [pop, setPop] = useState(false);
  const saved = has(product.id);

  const onClick = (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!saved) {
      setPop(true);
      setTimeout(() => setPop(false), 450);
    }
    void toggle(product, size);
  };

  const label = saved ? `Remove ${product.name} from wishlist` : `Save ${product.name} to wishlist`;
  return (
    <button
      type="button"
      className={`wish wish--${variant} ${saved ? "wish--on" : ""} ${pop ? "wish--pop" : ""}`}
      onClick={onClick}
      aria-pressed={saved}
      aria-label={label}
      title={saved ? "Saved to your wishlist" : "Save for later"}
    >
      <HeartIcon size={variant === "pdp" ? 20 : 18} filled={saved} />
      {variant === "pdp" && <span>{saved ? "Saved" : "Save"}</span>}
    </button>
  );
}
