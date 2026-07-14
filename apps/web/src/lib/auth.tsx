"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@ekulmis/shared";
import { api, clearAuthTokens, setAccessToken, setRefreshToken } from "./api";

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
  login: (identifier: string, password: string) => Promise<AuthUser>;
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

/** Module-level session for non-React stores (e.g. students cache). */
let cachedAuthUser: AuthUser | null = PREVIEW_AUTH ? PREVIEW_USER : null;

export function getCachedAuthUser(): AuthUser | null {
  return cachedAuthUser;
}

export function setCachedAuthUser(user: AuthUser | null) {
  cachedAuthUser = user;
}

function syncCachedAuthUser(user: AuthUser | null) {
  setCachedAuthUser(user);
}

function toAuthRole(role: string): UserRole {
  if (role === "SUPER_ADMINISTRATOR" || role === "ACADEMIC_MANAGER") {
    return "ADMINISTRATOR";
  }
  if (role === "RECEPTION_OFFICER") return "RECEPTION";
  const roles: UserRole[] = [
    "ADMINISTRATOR",
    "TEACHER",
    "PARENT",
    "STUDENT",
    "ATTENDANCE_OFFICER",
    "FINANCE_OFFICER",
    "EXAM_MANAGER",
    "RECEPTION",
  ];
  return roles.includes(role as UserRole) ? (role as UserRole) : "ADMINISTRATOR";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(
    PREVIEW_AUTH ? PREVIEW_USER : null,
  );
  const [loading, setLoading] = useState(!PREVIEW_AUTH);

  useEffect(() => {
    if (PREVIEW_AUTH) return;
    // Restore session from a stored token (refresh if access expired).
    api<AuthUser>("/auth/me")
      .then((me) => {
        syncCachedAuthUser(me);
        setUser(me);
      })
      .catch(() => {
        clearAuthTokens();
        syncCachedAuthUser(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  async function login(identifier: string, password: string): Promise<AuthUser> {
    if (PREVIEW_AUTH) {
      const { authenticateLocal } = await import("./users/store");
      const result = authenticateLocal(identifier, password);
      if (result.ok && result.user) {
        const authUser = {
          userId: result.user.id,
          schoolId: "demo",
          role: toAuthRole(result.user.role),
          username: result.user.username,
        };
        setUser(authUser);
        syncCachedAuthUser(authUser);
        return authUser;
      }
      if (identifier.trim() && password) {
        const authUser = { ...PREVIEW_USER, username: identifier.trim() };
        setUser(authUser);
        syncCachedAuthUser(authUser);
        return authUser;
      }
      throw new Error(result.error ?? "Login failed. Please try again.");
    }
    const res = await api<LoginResponse>("/auth/login", {
      method: "POST",
      body: { identifier, password },
      auth: false,
    });
    setAccessToken(res.accessToken);
    setRefreshToken(res.refreshToken);
    const me = await api<AuthUser>("/auth/me");
    syncCachedAuthUser(me);
    setUser(me);
    return me;
  }

  function logout() {
    clearAuthTokens();
    void import("./teachers/session").then((m) => m.clearTeacherMeCache());
    syncCachedAuthUser(null);
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
