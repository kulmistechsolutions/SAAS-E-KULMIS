/**
 * Thin API client for the NestJS backend. Sends the tenant subdomain header
 * (dev default "demo") and the bearer access token when present.
 */
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const TENANT = process.env.NEXT_PUBLIC_TENANT_SUBDOMAIN ?? "demo";

const TOKEN_KEY = "ekulmis_access_token";

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function setAccessToken(token: string | null): void {
  if (typeof window === "undefined") return;
  if (token) window.localStorage.setItem(TOKEN_KEY, token);
  else window.localStorage.removeItem(TOKEN_KEY);
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
}

export async function api<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const token = getAccessToken();
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-tenant-subdomain": TENANT,
  };
  if (opts.auth !== false && token) {
    headers.Authorization = `Bearer ${token}`;
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
    if (res.status === 401 && typeof window !== "undefined") {
      setAccessToken(null);
    }
    throw new ApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
