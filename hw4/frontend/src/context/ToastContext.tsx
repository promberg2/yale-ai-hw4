import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import { CheckIcon, CloseIcon } from "../components/Icons";

interface Toast {
  id: number;
  text: string;
  image?: string;
  action?: { label: string; to?: string; onClick?: () => void };
}

type ShowToast = (toast: Omit<Toast, "id">) => void;

const ToastContext = createContext<ShowToast | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);

  const dismiss = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

  const show = useCallback<ShowToast>(
    (toast) => {
      const id = nextId.current++;
      setToasts((t) => [...t.slice(-2), { ...toast, id }]);
      setTimeout(() => dismiss(id), 4200);
    },
    [dismiss],
  );

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.image ? <img src={t.image} alt="" /> : <span className="toast__icon"><CheckIcon size={16} /></span>}
            <span className="toast__text">{t.text}</span>
            {t.action &&
              (t.action.to ? (
                <Link to={t.action.to} className="toast__action" onClick={() => dismiss(t.id)}>
                  {t.action.label}
                </Link>
              ) : (
                <button
                  className="toast__action"
                  onClick={() => {
                    t.action?.onClick?.();
                    dismiss(t.id);
                  }}
                >
                  {t.action.label}
                </button>
              ))}
            <button className="toast__x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <CloseIcon size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside ToastProvider");
  return ctx;
}
