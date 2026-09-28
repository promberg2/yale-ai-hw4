import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface BagItem {
  productId: string;
  name: string;
  price: number;
  imageUrl: string;
  size: string;
  quantity: number;
  maxQuantity: number;
}

interface BagContextValue {
  items: BagItem[];
  count: number;
  subtotal: number;
  isOpen: boolean;
  open: () => void;
  close: () => void;
  add: (item: BagItem) => void;
  updateQuantity: (productId: string, size: string, quantity: number) => void;
  remove: (productId: string, size: string) => void;
  /** Caps a line at the stock that is really left (removing it at zero). */
  applyStock: (productId: string, size: string, available: number) => void;
  clear: () => void;
}

const BagContext = createContext<BagContextValue | null>(null);
const STORAGE_KEY = "cc-bag";

export function BagProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<BagItem[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]") as BagItem[];
    } catch {
      return [];
    }
  });
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  const value = useMemo<BagContextValue>(() => {
    const same = (a: BagItem, id: string, size: string) => a.productId === id && a.size === size;
    return {
      items,
      count: items.reduce((n, i) => n + i.quantity, 0),
      subtotal: items.reduce((n, i) => n + i.quantity * i.price, 0),
      isOpen,
      open: () => setIsOpen(true),
      close: () => setIsOpen(false),
      add: (item) =>
        setItems((prev) => {
          const existing = prev.find((i) => same(i, item.productId, item.size));
          if (!existing) return [...prev, item];
          return prev.map((i) =>
            same(i, item.productId, item.size)
              ? { ...i, quantity: Math.min(i.maxQuantity, i.quantity + item.quantity) }
              : i,
          );
        }),
      updateQuantity: (id, size, quantity) =>
        setItems((prev) =>
          prev.map((i) => (same(i, id, size) ? { ...i, quantity: Math.max(1, Math.min(i.maxQuantity, quantity)) } : i)),
        ),
      remove: (id, size) => setItems((prev) => prev.filter((i) => !same(i, id, size))),
      applyStock: (id, size, available) =>
        setItems((prev) =>
          available <= 0
            ? prev.filter((i) => !same(i, id, size))
            : prev.map((i) => (same(i, id, size) ? { ...i, quantity: Math.min(i.quantity, available), maxQuantity: available } : i)),
        ),
      clear: () => setItems([]),
    };
  }, [items, isOpen]);

  return <BagContext.Provider value={value}>{children}</BagContext.Provider>;
}

export function useBag() {
  const ctx = useContext(BagContext);
  if (!ctx) throw new Error("useBag must be used inside BagProvider");
  return ctx;
}
