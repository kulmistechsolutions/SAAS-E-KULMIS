"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@ekulmis/shared";
import { api, setAccessToken } from "./api";

export interface AuthUser {
  userId: string;
  schoolId: string;
  role: UserRole;
  username: string;
}

interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: { id: string; username: string; role: UserRole; schoolId: string };
}

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Preview mode lets the UI render without a running backend.
 * Enable by setting NEXT_PUBLIC_PREVIEW_AUTH=true (see .env.local).
 * Keep it off in production so real authentication is enforced.
 */
const PREVIEW_AUTH = process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";

const PREVIEW_USER: AuthUser = {
  userId: "preview-admin",
  schoolId: "demo",
  role: "ADMINISTRATOR",
  username: "Admin",
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    PREVIEW_AUTH ? PREVIEW_USER : null,
  );
  const [loading, setLoading] = useState(!PREVIEW_AUTH);

  useEffect(() => {
    if (PREVIEW_AUTH) return;
    // Restore session from a stored token.
    api<AuthUser>("/auth/me")
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string) {
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { identifier, password },
      auth: false,
    });
    setAccessToken(res.accessToken);
    const me = await api<AuthUser>("/auth/me");
    setUser(me);
  }

  function logout() {
    setAccessToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
