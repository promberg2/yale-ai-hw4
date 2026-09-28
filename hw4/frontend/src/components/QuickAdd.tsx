import { useState, type MouseEvent, type SyntheticEvent } from "react";
import { displayName, fetchProduct, type ProductSummary, type SizeStock } from "../api";
import { useAuth } from "../context/AuthContext";
import { useBag } from "../context/BagContext";
import { useToast } from "../context/ToastContext";
import { PlusIcon } from "./Icons";

const sizeCache = new Map<string, Promise<SizeStock[]>>();

function loadSizes(id: string): Promise<SizeStock[]> {
  let p = sizeCache.get(id);
  if (!p) {
    p = fetchProduct(id).then((d) => d.sizes);
    p.catch(() => sizeCache.delete(id));
    sizeCache.set(id, p);
    setTimeout(() => sizeCache.delete(id), 60_000);
  }
  return p;
}

const stop = (e: SyntheticEvent) => {
  e.preventDefault();
  e.stopPropagation();
};

export default function QuickAdd({ product }: { product: ProductSummary }) {
  const [open, setOpen] = useState(false);
  const [sizes, setSizes] = useState<SizeStock[] | null>(null);
  const [failed, setFailed] = useState(false);
  const { add, open: openBag } = useBag();
  const { user } = useAuth();
  const toast = useToast();

  const show = (e: MouseEvent) => {
    stop(e);
    setOpen(true);
    setFailed(false);
    loadSizes(product.id)
      .then(setSizes)
      .catch(() => setFailed(true));
  };

  const choose = (e: MouseEvent, s: SizeStock) => {
    stop(e);
    if (s.quantity <= 0) return;
    add({
      productId: product.id,
      name: product.name,
      price: product.price,
      imageUrl: product.image_url,
      size: s.size,
      quantity: 1,
      maxQuantity: s.quantity,
    });
    sizeCache.delete(product.id);
    setOpen(false);
    toast({
      text: `${displayName(product.name)} · ${s.size} added to your bag`,
      image: product.image_url,
      action: { label: "View bag", onClick: openBag },
    });
  };

  return (
    <div className={`qa ${open ? "qa--open" : ""}`} onClick={stop} onMouseLeave={() => setOpen(false)}>
      {open ? (
        <div className="qa__panel" role="group" aria-label={`Choose a size for ${product.name}`}>
          <span className="qa__label">{failed ? "Couldn't load sizes" : "Add to bag — pick your size"}</span>
          <div className="qa__sizes">
            {sizes
              ? sizes.map((s) => (
                  <button
                    key={s.size}
                    type="button"
                    className={`qa__size ${s.size === user?.preferred_size ? "qa__size--mine" : ""} ${s.status === "low_stock" ? "qa__size--low" : ""}`}
                    disabled={s.quantity <= 0}
                    onClick={(e) => choose(e, s)}
                    title={s.quantity <= 0 ? "Sold out" : s.status === "low_stock" ? `Only ${s.quantity} left` : `${s.quantity} in stock`}
                  >
                    {s.size}
                  </button>
                ))
              : !failed && <span className="qa__loading">Checking live stock…</span>}
          </div>
        </div>
      ) : (
        <button type="button" className="qa__btn" onClick={show} aria-label={`Quick add ${product.name}`}>
          <PlusIcon size={16} /> <span>Quick add</span>
        </button>
      )}
    </div>
  );
}
