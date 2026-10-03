import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { api, ApiError, type User } from "./api";

type Session = { user: User | null; loading: boolean; error: string; refresh: () => Promise<void>; login: (email: string, password: string) => Promise<void>; logout: () => Promise<void> };
const AuthContext = createContext<Session | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const authenticating = useRef(false);
  const refresh = useCallback(async () => {
    if (authenticating.current) return;
    const attempt = ++generation.current;
    try {
      const result = await api<{ user: User }>("/auth/me");
      if (attempt !== generation.current) return;
      setUser(result.user); setError("");
    }
    catch (err) {
      if (attempt !== generation.current) return;
      setUser(null);
      setError(err instanceof ApiError && err.status === 401 ? "" : "Cannot reach the salon workspace. Please try again.");
    } finally { if (attempt === generation.current) setLoading(false); }
  }, []);
  useEffect(() => {
    void refresh();
    const expired = () => { generation.current++; setUser(null); };
    const focus = () => { void refresh(); };
    window.addEventListener("session-expired", expired);
    window.addEventListener("focus", focus);
    return () => { window.removeEventListener("session-expired", expired); window.removeEventListener("focus", focus); };
  }, [refresh]);
  const login = async (email: string, password: string) => {
    generation.current++; authenticating.current = true;
    try {
      setUser((await api<{ user: User }>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) })).user);
      setError("");
    } finally { authenticating.current = false; }
  };
  const logout = async () => {
    generation.current++; authenticating.current = true;
    try { await api("/auth/logout", { method: "POST" }); setUser(null); }
    finally { authenticating.current = false; }
  };
  return <AuthContext.Provider value={{ user, loading, error, refresh, login, logout }}>{children}</AuthContext.Provider>;
}
export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("AuthProvider is required.");
  return value;
}
