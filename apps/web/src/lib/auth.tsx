import { createContext, useContext, useState, type ReactNode } from "react";

export type Role = "ADMIN" | "CAJERO";

export interface AuthUser {
  id: string;
  name: string;
  role: Role;
}

interface AuthState {
  user: AuthUser | null;
  token: string | null;
  login: (pin: string) => Promise<void>;
  logout: () => void;
  error: string | null;
}

const AuthContext = createContext<AuthState | null>(null);

const TOKEN_KEY = "chonta_pos_token";
const USER_KEY = "chonta_pos_user";

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  });
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [error, setError] = useState<string | null>(null);

  async function login(pin: string) {
    setError(null);
    const res = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin }),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError(body.error ?? "No se pudo iniciar sesión");
      throw new Error(body.error ?? "Login failed");
    }
    const body = await res.json();
    // Written synchronously (not via a useEffect) so it lands in localStorage before the
    // caller navigates — otherwise the next page's mount-time API calls can fire with no
    // token yet, get 401'd, and immediately bounce back to /login right after a real login.
    localStorage.setItem(TOKEN_KEY, body.token);
    localStorage.setItem(USER_KEY, JSON.stringify(body.user));
    setToken(body.token);
    setUser(body.user);
  }

  function logout() {
    clearSession();
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, login, logout, error }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth debe usarse dentro de AuthProvider");
  return ctx;
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function clearSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}
