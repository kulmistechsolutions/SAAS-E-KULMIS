"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import {
  getPlatformAccessToken,
  platformLogin,
  platformLogout,
  platformMe,
  setPlatformTokens,
} from "./api";
import type { PlatformAdmin } from "./types";

/**
 * Preview only softens the UI when the API is unreachable.
 * Login always prefers a real JWT so platform SMS / Waafi routes work.
 */
const PREVIEW =
  process.env.NEXT_PUBLIC_PREVIEW_PLATFORM_AUTH === "true" ||
  process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";

const PREVIEW_ADMIN: PlatformAdmin = {
  adminId: "preview-superadmin",
  username: "superadmin",
  name: "Super Admin",
  role: "SUPER_ADMIN",
};

const SESSION_KEY = "ekulmis_platform_session";

interface PlatformAuthValue {
  admin: PlatformAdmin | null;
  loading: boolean;
  isPreview: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const PlatformAuthContext = createContext<PlatformAuthValue | null>(null);

export function PlatformAuthProvider({ children }: { children: ReactNode }) {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPreviewSession, setIsPreviewSession] = useState(false);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      const token = getPlatformAccessToken();
      if (token) {
        try {
          const me = await platformMe();
          if (!cancelled) {
            setAdmin(me);
            setIsPreviewSession(false);
          }
          return;
        } catch {
          setPlatformTokens(null, null);
        }
      }

      // Stale preview-only session (no JWT) cannot call the API — force re-login.
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY);
      }
      if (!cancelled) {
        setAdmin(null);
        setIsPreviewSession(false);
      }
    })()
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (identifier: string, password: string) => {
    // Always try the real platform API first so SMS/Waafi get a bearer token.
    try {
      const res = await platformLogin(identifier, password);
      setPlatformTokens(res.accessToken, res.refreshToken);
      setAdmin({
        adminId: res.admin.id,
        username: res.admin.username,
        name: res.admin.name,
        role: res.admin.role,
      });
      setIsPreviewSession(false);
      if (typeof window !== "undefined") {
        localStorage.removeItem(SESSION_KEY);
      }
      return;
    } catch (err) {
      if (!PREVIEW) throw err;
    }

    // Offline / API-down fallback for local UI demos only.
    const ok =
      identifier.trim().toLowerCase() === "superadmin" && password === "super123";
    if (!ok) throw new Error("Invalid credentials (and API login failed).");
    if (typeof window !== "undefined") {
      localStorage.setItem(SESSION_KEY, "1");
    }
    setPlatformTokens(null, null);
    setAdmin(PREVIEW_ADMIN);
    setIsPreviewSession(true);
  }, []);

  const logout = useCallback(async () => {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
    try {
      await platformLogout();
    } catch {
      setPlatformTokens(null, null);
    }
    setAdmin(null);
    setIsPreviewSession(false);
  }, []);

  return (
    <PlatformAuthContext.Provider
      value={{
        admin,
        loading,
        isPreview: isPreviewSession,
        login,
        logout,
      }}
    >
      {children}
    </PlatformAuthContext.Provider>
  );
}

export function usePlatformAuth(): PlatformAuthValue {
  const ctx = useContext(PlatformAuthContext);
  if (!ctx) throw new Error("usePlatformAuth must be used within PlatformAuthProvider");
  return ctx;
}
