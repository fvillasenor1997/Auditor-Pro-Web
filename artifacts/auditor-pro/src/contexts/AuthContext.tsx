import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { setAuthTokenGetter } from "@workspace/api-client-react";
import {
  getAuthToken,
  setAuthToken,
  clearAuth,
  getStoredUser,
  type AuthUser,
} from "@/lib/auth";

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const BASE = import.meta.env.BASE_URL as string;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Wire up the global auth token getter for generated API hooks
  useEffect(() => {
    setAuthTokenGetter(() => getAuthToken());
    return () => setAuthTokenGetter(null);
  }, []);

  // On mount: restore session from localStorage + validate with server
  useEffect(() => {
    const storedUser = getStoredUser();
    const token = getAuthToken();

    if (!storedUser || !token) {
      setIsLoading(false);
      return;
    }

    // Set user immediately from localStorage (optimistic)
    setUser(storedUser);

    // Validate token with server in background
    fetch(`${BASE}api/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(async (res) => {
        if (res.ok) {
          const data = await res.json() as AuthUser;
          setUser(data);
        } else {
          // Token expired or invalid
          clearAuth();
          setUser(null);
        }
      })
      .catch(() => {
        // Network error — keep cached user for offline-first UX
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, []);

  const login = useCallback(async (username: string, password: string): Promise<void> => {
    const res = await fetch(`${BASE}api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username, password }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: "Error de conexión" })) as { error?: string };
      throw new Error(err.error ?? "Credenciales inválidas");
    }

    const data = await res.json() as { token: string; role: "admin" | "auditor"; username: string };
    const authUser: AuthUser = {
      userId: 0, // will be populated from /me if needed
      username: data.username,
      role: data.role,
    };

    setAuthToken(data.token, authUser);
    setUser(authUser);
  }, []);

  const logout = useCallback(() => {
    clearAuth();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated: user !== null, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}
