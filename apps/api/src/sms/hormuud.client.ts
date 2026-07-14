/**
 * Hormuud SMS API client.
 * Docs: https://smsapi.hormuud.com/Documentation.pdf
 *
 * Auth: POST /token (grant_type=password) → Bearer token
 * Send: POST /api/SendSMS
 * Balance: POST /api/checkbalance { service: "smsapi" }
 */

export interface HormuudConfig {
  baseUrl: string;
  username: string;
  password: string;
}

export interface HormuudSendRequest {
  mobile: string;
  message: string;
  senderid: string;
  refid?: string;
}

export interface HormuudSendResult {
  ok: boolean;
  responseCode?: string;
  responseMessage?: string;
  messageId?: string;
  totalSms?: number;
  raw?: unknown;
  error?: string;
}

export interface HormuudConnectionStep {
  step: string;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  message: string;
  detail?: unknown;
}

export interface HormuudConnectionTestResult {
  ok: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
  providerBalance?: string;
  tokenExpiresIn?: number;
  steps: HormuudConnectionStep[];
  testedAt: string;
}

interface TokenCache {
  accessToken: string;
  expiresAt: number;
  expiresIn?: number;
}

let tokenCache: TokenCache | null = null;

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
}

/** GSM-7 approx: 160 chars / part; Unicode: 70. Returns credit units. */
export function estimateSmsCredits(body: string): number {
  const hasUnicode = /[^\x00-\x7F]/.test(body);
  const limit = hasUnicode ? 70 : 160;
  const concatLimit = hasUnicode ? 67 : 153;
  if (body.length <= limit) return 1;
  return Math.ceil(body.length / concatLimit);
}

export function normalizeSomaliPhone(phone: string): string {
  let p = phone.replace(/[^\d+]/g, "").trim();
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00252")) p = p.slice(2);
  if (p.startsWith("252")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  if (
    p.length === 9 &&
    (p.startsWith("61") ||
      p.startsWith("62") ||
      p.startsWith("63") ||
      p.startsWith("68") ||
      p.startsWith("69"))
  ) {
    return `252${p}`;
  }
  return p;
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Request an OAuth access token from Hormuud.
 * Always hits the network when `forceRefresh` is true (used by Test Connection).
 */
export async function hormuudFetchToken(
  config: HormuudConfig,
  opts: { forceRefresh?: boolean } = {},
): Promise<{
  accessToken: string;
  expiresIn: number;
  httpStatus: number;
  raw: unknown;
}> {
  const now = Date.now();
  if (
    !opts.forceRefresh &&
    tokenCache &&
    tokenCache.expiresAt > now + 30_000
  ) {
    return {
      accessToken: tokenCache.accessToken,
      expiresIn: tokenCache.expiresIn ?? 3600,
      httpStatus: 200,
      raw: { cached: true },
    };
  }

  if (!config.username?.trim() || !config.password) {
    throw Object.assign(new Error("Username and password are required."), {
      httpStatus: 0,
    });
  }

  const base = normalizeBaseUrl(config.baseUrl || "https://smsapi.hormuud.com");
  const body = new URLSearchParams({
    grant_type: "password",
    username: config.username.trim(),
    password: config.password,
  });

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${base}/token`,
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body,
      },
      20_000,
    );
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Token request timed out after 20s."
          : e.message
        : "Token request failed.";
    throw Object.assign(new Error(msg), { httpStatus: 0 });
  }

  const text = await res.text();
  let json: Record<string, unknown> = {};
  try {
    json = JSON.parse(text) as Record<string, unknown>;
  } catch {
    throw Object.assign(
      new Error(`Token response was not JSON: ${text.slice(0, 200)}`),
      { httpStatus: res.status, raw: text },
    );
  }

  if (!res.ok || !json.access_token) {
    throw Object.assign(
      new Error(
        String(
          json.error_description ??
            json.error ??
            json.Message ??
            `Token HTTP ${res.status}`,
        ),
      ),
      { httpStatus: res.status, raw: json },
    );
  }

  const expiresIn = Number(json.expires_in ?? 3600);
  tokenCache = {
    accessToken: String(json.access_token),
    expiresAt: now + expiresIn * 1000,
    expiresIn,
  };
  return {
    accessToken: tokenCache.accessToken,
    expiresIn,
    httpStatus: res.status,
    raw: {
      token_type: json.token_type,
      expires_in: expiresIn,
      // never log the access token itself
      has_access_token: true,
    },
  };
}

export function clearHormuudTokenCache() {
  tokenCache = null;
}

/** Optional balance check — soft-fails if the endpoint is unavailable. */
export async function hormuudCheckBalance(
  config: HormuudConfig,
  accessToken: string,
): Promise<{
  ok: boolean;
  balance?: string;
  httpStatus?: number;
  message: string;
  raw?: unknown;
}> {
  const base = normalizeBaseUrl(config.baseUrl || "https://smsapi.hormuud.com");
  try {
    const res = await fetchWithTimeout(
      `${base}/api/checkbalance`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/json",
        },
        body: JSON.stringify({ service: "smsapi" }),
      },
      15_000,
    );
    const text = await res.text();
    let json: unknown = text;
    try {
      json = JSON.parse(text);
    } catch {
      /* keep text */
    }

    if (!res.ok) {
      return {
        ok: false,
        httpStatus: res.status,
        message: `Balance check HTTP ${res.status}`,
        raw: json,
      };
    }

    const obj = (json ?? {}) as Record<string, unknown>;
    const balance = String(
      obj.Balance ??
        obj.balance ??
        obj.Data ??
        obj.data ??
        obj.ResponseMessage ??
        obj.responseMessage ??
        (typeof json === "string" || typeof json === "number" ? json : "") ??
        "",
    );

    return {
      ok: true,
      balance: balance || undefined,
      httpStatus: res.status,
      message: balance
        ? `Provider balance: ${balance}`
        : "Balance endpoint responded OK.",
      raw: json,
    };
  } catch (e) {
    return {
      ok: false,
      message:
        e instanceof Error
          ? e.name === "AbortError"
            ? "Balance check timed out."
            : e.message
          : "Balance check failed.",
    };
  }
}

/**
 * Full connection verification: validate inputs → authenticate → optional balance.
 * Does not send an SMS (no cost / no side effects on recipient numbers).
 */
export async function hormuudTestConnection(
  config: HormuudConfig,
): Promise<HormuudConnectionTestResult> {
  const testedAt = new Date().toISOString();
  const steps: HormuudConnectionStep[] = [];

  // Step 1 — validate local inputs
  const t0 = Date.now();
  if (!config.baseUrl?.trim()) {
    steps.push({
      step: "validate",
      ok: false,
      durationMs: Date.now() - t0,
      message: "Base URL is required.",
    });
    return {
      ok: false,
      status: "DISCONNECTED",
      message: "Base URL is required.",
      steps,
      testedAt,
    };
  }
  try {
    // eslint-disable-next-line no-new
    new URL(config.baseUrl);
  } catch {
    steps.push({
      step: "validate",
      ok: false,
      durationMs: Date.now() - t0,
      message: "Base URL is not a valid URL.",
    });
    return {
      ok: false,
      status: "ERROR",
      message: "Base URL is not a valid URL.",
      steps,
      testedAt,
    };
  }
  if (!config.username?.trim() || !config.password) {
    steps.push({
      step: "validate",
      ok: false,
      durationMs: Date.now() - t0,
      message: "API username and password are required.",
    });
    return {
      ok: false,
      status: "DISCONNECTED",
      message: "API username and password are required.",
      steps,
      testedAt,
    };
  }
  steps.push({
    step: "validate",
    ok: true,
    durationMs: Date.now() - t0,
    message: `Credentials present. Endpoint: ${normalizeBaseUrl(config.baseUrl)}/token`,
  });

  // Step 2 — authenticate (force fresh token)
  clearHormuudTokenCache();
  const t1 = Date.now();
  let tokenResult: Awaited<ReturnType<typeof hormuudFetchToken>>;
  try {
    tokenResult = await hormuudFetchToken(config, { forceRefresh: true });
    steps.push({
      step: "authenticate",
      ok: true,
      durationMs: Date.now() - t1,
      httpStatus: tokenResult.httpStatus,
      message: `Access token obtained (expires in ${tokenResult.expiresIn}s).`,
      detail: tokenResult.raw,
    });
  } catch (e) {
    const err = e as Error & { httpStatus?: number; raw?: unknown };
    steps.push({
      step: "authenticate",
      ok: false,
      durationMs: Date.now() - t1,
      httpStatus: err.httpStatus,
      message: err.message,
      detail: err.raw,
    });
    const isNetwork = !err.httpStatus;
    return {
      ok: false,
      status: isNetwork ? "ERROR" : "DISCONNECTED",
      message: err.message,
      steps,
      testedAt,
    };
  }

  // Step 3 — balance (informational; auth success is enough to verify)
  const t2 = Date.now();
  const balance = await hormuudCheckBalance(config, tokenResult.accessToken);
  steps.push({
    step: "check_balance",
    ok: balance.ok,
    durationMs: Date.now() - t2,
    httpStatus: balance.httpStatus,
    message: balance.message,
    detail: balance.raw,
  });

  return {
    ok: true,
    status: "CONNECTED",
    message: balance.ok && balance.balance
      ? `Connected to Hormuud SMS API. Provider balance: ${balance.balance}`
      : "Connected to Hormuud SMS API. Authentication successful.",
    providerBalance: balance.balance,
    tokenExpiresIn: tokenResult.expiresIn,
    steps,
    testedAt,
  };
}

export async function hormuudSendSms(
  config: HormuudConfig,
  req: HormuudSendRequest,
): Promise<HormuudSendResult> {
  if (!config.username || !config.password) {
    return { ok: false, error: "Hormuud SMS credentials are not configured." };
  }

  const mobile = normalizeSomaliPhone(req.mobile);
  if (mobile.length < 9) {
    return { ok: false, error: `Invalid phone number: ${req.mobile}` };
  }

  let token: string;
  try {
    const t = await hormuudFetchToken(config);
    token = t.accessToken;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : "Failed to authenticate with Hormuud.",
    };
  }

  const base = normalizeBaseUrl(config.baseUrl);
  const payload = {
    refid: req.refid ?? "",
    mobile,
    message: req.message,
    senderid: req.senderid.slice(0, 20),
    mType: -1,
    eType: -1,
    validity: 0,
    delivery: 0,
    UDH: "",
  };

  try {
    const res = await fetchWithTimeout(
      `${base}/api/SendSMS`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      },
      30_000,
    );
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      return {
        ok: false,
        error: `Invalid Hormuud response: ${text.slice(0, 200)}`,
        raw: text,
      };
    }

    const responseCode = String(json.ResponseCode ?? json.responseCode ?? "");
    const responseMessage = String(
      json.ResponseMessage ?? json.responseMessage ?? "",
    );
    const data = (json.Data ?? json.data) as Record<string, unknown> | undefined;
    const messageId = data
      ? String(data.MessageID ?? data.messageId ?? "")
      : undefined;
    const details = data?.Details as Record<string, unknown> | undefined;
    const totalSms = details
      ? Number(details.TotalSMS ?? details.totalSMS ?? 1)
      : estimateSmsCredits(req.message);

    const ok =
      res.ok &&
      (responseCode === "200" ||
        responseCode === "0" ||
        responseCode.toLowerCase() === "success" ||
        Boolean(messageId));

    if (!ok) {
      if (res.status === 401) clearHormuudTokenCache();
      return {
        ok: false,
        responseCode,
        responseMessage,
        error: responseMessage || `Hormuud send failed (HTTP ${res.status})`,
        raw: json,
        totalSms,
      };
    }

    return {
      ok: true,
      responseCode,
      responseMessage,
      messageId: messageId || undefined,
      totalSms: Number.isFinite(totalSms) && totalSms > 0 ? totalSms : 1,
      raw: json,
    };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Hormuud SMS request timed out."
          : e.message
        : "Hormuud SMS request failed.";
    return { ok: false, error: msg };
  }
}
