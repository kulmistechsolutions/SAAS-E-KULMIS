/**
 * Thin API client for the NestJS backend. Sends the tenant subdomain header
 * (dev default "demo") and the bearer access token when present.
 * Automatically refreshes expired access tokens using the stored refresh token.
 */
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ROOT_DOMAIN = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "";

/**
 * Resolve the tenant subdomain from the browser hostname at runtime
 * (school1.example.com → "school1"), so one deployed build serves every
 * school. Falls back to NEXT_PUBLIC_TENANT_SUBDOMAIN (default "demo") on
 * localhost/dev or when no subdomain is present.
 */
function resolveTenant(): string {
  const fallback = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN ?? "demo";
  if (typeof window === "undefined") return fallback;
  const host = window.location.hostname.toLowerCase();
  if (host === "localhost" || /^[\d.]+$/.test(host)) return fallback;
  if (ROOT_DOMAIN && host.endsWith(`.${ROOT_DOMAIN}`)) {
    const sub = host.slice(0, host.length - ROOT_DOMAIN.length - 1);
    if (sub && sub !== "www") return sub;
    return fallback;
  }
  // No root domain configured: treat the left-most label as the subdomain
  // when the host has 3+ labels (school1.example.com).
  const parts = host.split(".");
  if (parts.length >= 3 && parts[0] !== "www") return parts[0];
  return fallback;
}

export const TENANT = resolveTenant();

const TOKEN_KEY = "ekulmis_access_token";
const REFRESH_KEY = "ekulmis_refresh_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
}

export function setRefreshToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(REFRESH_KEY, token);
  else window.localStorage.removeItem(REFRESH_KEY);
}

export function clearAuthTokens(): void {
  setAccessToken(null);
  setRefreshToken(null);
}

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  auth?: boolean;
  /** Internal: skip refresh retry to avoid loops. */
  _retried?: boolean;
}

let refreshInFlight: Promise<boolean> | null = null;

async function tryRefreshAccessToken(): Promise<boolean> {
  if (refreshInFlight) return refreshInFlight;
  refreshInFlight = (async () => {
    const refresh = getRefreshToken();
    if (!refresh) return false;
    try {
      const res = await fetch(`${API_URL}/api/auth/refresh`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-tenant-subdomain": TENANT,
        },
        body: JSON.stringify({ refreshToken: refresh }),
      });
      if (!res.ok) {
        clearAuthTokens();
        return false;
      }
      const data = (await res.json()) as {
        accessToken?: string;
        refreshToken?: string;
      };
      if (!data.accessToken) {
        clearAuthTokens();
        return false;
      }
      setAccessToken(data.accessToken);
      if (data.refreshToken) setRefreshToken(data.refreshToken);
      return true;
    } catch {
      clearAuthTokens();
      return false;
    } finally {
      refreshInFlight = null;
    }
  })();
  return refreshInFlight;
}

function redirectToLogin(): void {
  if (typeof window === "undefined") return;
  const path = window.location.pathname;
  if (path.startsWith("/login") || path.startsWith("/platform")) return;
  // Keep portal users on their own sign-in page instead of the staff login.
  if (path.startsWith("/teacher-portal")) {
    if (path !== "/teacher-portal/login") window.location.assign("/teacher-portal/login");
    return;
  }
  if (path.startsWith("/parent-portal")) {
    if (path !== "/parent-portal/login") window.location.assign("/parent-portal/login");
    return;
  }
  window.location.assign("/login");
}

export async function api<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  let token = getAccessToken();

  // Access token missing but refresh available — renew before the request.
  if (opts.auth !== false && !token && getRefreshToken()) {
    const ok = await tryRefreshAccessToken();
    if (ok) token = getAccessToken();
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-subdomain": TENANT,
  };
  if (opts.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
  }

  if (opts.auth !== false && !token) {
    throw new ApiError(
      401,
      "Your session has expired. Please sign in again.",
    );
  }

  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message)
          ? data.message.join(", ")
          : data.message;
      }
    } catch {
      // keep statusText
    }
    if (res.status === 413) {
      message =
        "The image is too large for the server to accept. Use a photo under 2 MB.";
    }

    // Expired/invalid access token — refresh once and retry.
    if (
      res.status === 401 &&
      opts.auth !== false &&
      !opts._retried &&
      typeof window !== "undefined"
    ) {
      const refreshed = await tryRefreshAccessToken();
      if (refreshed) {
        return api<T>(path, { ...opts, _retried: true });
      }
      clearAuthTokens();
      redirectToLogin();
      throw new ApiError(
        401,
        "Your session has expired. Please sign in again.",
      );
    }

    if (res.status === 401 && typeof window !== "undefined") {
      clearAuthTokens();
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
