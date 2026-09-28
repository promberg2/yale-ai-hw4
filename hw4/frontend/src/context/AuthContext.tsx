import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export interface User {
  id: number;
  first_name: string | null;
  last_name: string | null;
  name: string;
  email: string;
  preferred_size: string | null;
}

export interface RegisterInput {
  first_name: string;
  last_name: string;
  email: string;
  password: string;
  confirm_password: string;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  /** Re-reads the signed-in customer after they edit their profile. */
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Turns FastAPI error payloads (string or validation array) into one message. */
async function errorMessage(res: Response, fallback: string): Promise<string> {
  try {
    const data = await res.json();
    if (typeof data?.detail === "string") return data.detail;
    if (Array.isArray(data?.detail) && data.detail[0]?.msg) return data.detail[0].msg;
  } catch {
    /* no body */
  }
  return fallback;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const loadMe = () =>
    fetch("/api/auth/me", { credentials: "include" })
      .then((r) => (r.ok ? r.json() : null))
      .then((u: User | null) => setUser(u))
      .catch(() => setUser(null));

  useEffect(() => {
    loadMe().finally(() => setLoading(false));
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login: async (email, password) => {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ email, password }),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "Unable to log in. Please try again."));
        setUser(await res.json());
      },
      register: async (input) => {
        const res = await fetch("/api/auth/register", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(input),
        });
        if (!res.ok) throw new Error(await errorMessage(res, "Unable to create your account. Please try again."));
        setUser(await res.json());
      },
      logout: async () => {
        await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
        setUser(null);
      },
      refresh: loadMe,
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
