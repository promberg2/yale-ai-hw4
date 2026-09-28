import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { fetchWishlist, removeFromWishlist, saveToWishlist, type WishlistItem } from "../lib/account";
import { useAuth } from "./AuthContext";
import { useToast } from "./ToastContext";

interface SaveTarget {
  id: string;
  name: string;
  image_url: string;
}

interface WishlistContextValue {
  items: WishlistItem[];
  count: number;
  has: (productId: string) => boolean;
  /** Saves (or, if already saved, removes) a product. Guests are sent to log in and it is saved right after. */
  toggle: (product: SaveTarget, size?: string | null) => Promise<void>;
  save: (product: SaveTarget, size?: string | null, quiet?: boolean) => Promise<void>;
  remove: (productId: string) => Promise<void>;
  refresh: () => Promise<void>;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);
const PENDING_KEY = "cc-pending-wish";

export function WishlistProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [items, setItems] = useState<WishlistItem[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return setItems([]);
    setItems(await fetchWishlist().catch(() => []));
  }, [user]);

  const save = useCallback<WishlistContextValue["save"]>(
    async (product, size = null, quiet = false) => {
      setItems(await saveToWishlist(product.id, size));
      if (!quiet) {
        toast({ text: `Saved ${product.name}${size ? ` in ${size}` : ""} to your wishlist`, image: product.image_url, action: { label: "View", to: "/account?tab=wishlist" } });
      }
    },
    [toast],
  );

  useEffect(() => {
    if (loading) return;
    if (!user) {
      setItems([]);
      return;
    }
    const pending = sessionStorage.getItem(PENDING_KEY);
    sessionStorage.removeItem(PENDING_KEY);
    if (pending) {
      const { product, size } = JSON.parse(pending) as { product: SaveTarget; size: string | null };
      void save(product, size);
    } else {
      void refresh();
    }
  }, [user, loading, refresh, save]);

  const value = useMemo<WishlistContextValue>(() => {
    const ids = new Set(items.map((i) => i.product.id));
    const remove = async (productId: string) => setItems(await removeFromWishlist(productId));
    return {
      items,
      count: items.length,
      has: (id) => ids.has(id),
      save,
      remove,
      refresh,
      toggle: async (product, size = null) => {
        if (!user) {
          sessionStorage.setItem(PENDING_KEY, JSON.stringify({ product, size }));
          navigate("/login", { state: { from: location.pathname + location.search, reason: "wishlist" } });
          return;
        }
        if (ids.has(product.id)) {
          await remove(product.id);
          toast({ text: `Removed ${product.name} from your wishlist` });
        } else {
          await save(product, size);
        }
      },
    };
  }, [items, user, save, refresh, navigate, location.pathname, location.search, toast]);

  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist() {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside WishlistProvider");
  return ctx;
}
