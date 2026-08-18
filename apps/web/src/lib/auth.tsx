"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { UserRole } from "@ekulmis/shared";
import {
  api,
  clearAuthTokens,
  getRefreshToken,
  redirectToLogin,
  setAccessToken,
  setRefreshToken,
} from "./api";
import { useIdleLogout } from "./session/use-idle-logout";

export interface AuthUser {
  userId: string;
  schoolId: string;
  role: UserRole;
  username: string;
  /** How many idle minutes this school allows before forcing a re-login. */
  sessionTimeoutMinutes?: number;
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

/**
 * Settings (e.g. Session Timeout) change what `/auth/me` returns, but the
 * signed-in user's session was fetched once at login and never refetched —
 * so saving a shorter/longer timeout had no visible effect until the next
 * login. Any code that changes account-affecting settings should call this
 * right after a successful save so the running session picks it up now.
 */
const AUTH_REFRESH_EVENT = "ekulmis-auth-refresh";

export function requestAuthRefresh(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(AUTH_REFRESH_EVENT));
  }
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
    // Restore session from a stored token (refresh if access expired). A
    // failure here means both the access and refresh token are dead — send
    // the user to sign in instead of leaving a portal page rendering with
    // user===null while its own components silently 401 in the background.
    api<AuthUser>("/auth/me")
      .then((me) => {
        syncCachedAuthUser(me);
        setUser(me);
      })
      .catch(() => {
        clearAuthTokens();
        syncCachedAuthUser(null);
        setUser(null);
        redirectToLogin();
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (PREVIEW_AUTH) return;
    function onRefresh() {
      void api<AuthUser>("/auth/me")
        .then((me) => {
          syncCachedAuthUser(me);
          setUser(me);
        })
        .catch(() => {});
    }
    window.addEventListener(AUTH_REFRESH_EVENT, onRefresh);
    return () => window.removeEventListener(AUTH_REFRESH_EVENT, onRefresh);
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
    // Best-effort: revoke the refresh token server-side too, so a copy of it
    // (stolen, or left in another tab) can't keep minting new access tokens
    // for its full 7-day life after this device has logged out.
    const refreshToken = getRefreshToken();
    if (refreshToken) {
      void api("/auth/logout", {
        method: "POST",
        body: { refreshToken },
        auth: false,
      }).catch(() => {});
    }
    clearAuthTokens();
    void import("./teachers/session").then((m) => m.clearTeacherMeCache());
    syncCachedAuthUser(null);
    setUser(null);
  }

  const handleIdleTimeout = useCallback(() => {
    logout();
    redirectToLogin();
  }, []);

  useIdleLogout(PREVIEW_AUTH ? undefined : user?.sessionTimeoutMinutes, handleIdleTimeout);

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
