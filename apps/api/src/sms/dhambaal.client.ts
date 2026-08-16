/**
 * Dhambaal SMS API client (golis.so).
 * Docs supplied by the school's platform admin.
 *
 * Auth: Bearer token (issued out-of-band by Dhambaal, not obtained via this API)
 * Send: POST /api/v3/sms/send
 * List (used here as a harmless connection check — no message sent): GET /api/v3/sms
 */

export interface DhambaalConfig {
  baseUrl: string;
  apiToken: string;
}

export interface DhambaalSendRequest {
  mobile: string;
  message: string;
  senderid: string;
  refid?: string;
}

export interface DhambaalSendResult {
  ok: boolean;
  responseCode?: string;
  responseMessage?: string;
  messageId?: string;
  totalSms?: number;
  raw?: unknown;
  error?: string;
}

export interface DhambaalConnectionStep {
  step: string;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  message: string;
  detail?: unknown;
}

export interface DhambaalConnectionTestResult {
  ok: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
  steps: DhambaalConnectionStep[];
  testedAt: string;
}

function normalizeBaseUrl(url: string): string {
  return url.replace(/\/+$/, "");
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

/** Same normalization as Hormuud's client — Dhambaal expects international
 *  format without the leading "+" (e.g. 252611111111). */
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

/**
 * Connection verification: validate inputs, then call the message-listing
 * endpoint with the given token. Does not send an SMS (no cost / no side
 * effects on recipient numbers) — mirrors hormuudTestConnection's intent.
 */
export async function dhambaalTestConnection(
  config: DhambaalConfig,
): Promise<DhambaalConnectionTestResult> {
  const testedAt = new Date().toISOString();
  const steps: DhambaalConnectionStep[] = [];

  const t0 = Date.now();
  if (!config.baseUrl?.trim()) {
    steps.push({ step: "validate", ok: false, durationMs: Date.now() - t0, message: "Base URL is required." });
    return { ok: false, status: "DISCONNECTED", message: "Base URL is required.", steps, testedAt };
  }
  try {
    // eslint-disable-next-line no-new
    new URL(config.baseUrl);
  } catch {
    steps.push({ step: "validate", ok: false, durationMs: Date.now() - t0, message: "Base URL is not a valid URL." });
    return { ok: false, status: "ERROR", message: "Base URL is not a valid URL.", steps, testedAt };
  }
  if (!config.apiToken?.trim()) {
    steps.push({ step: "validate", ok: false, durationMs: Date.now() - t0, message: "API token is required." });
    return { ok: false, status: "DISCONNECTED", message: "API token is required.", steps, testedAt };
  }
  steps.push({ step: "validate", ok: true, durationMs: Date.now() - t0, message: "Credentials present." });

  const base = normalizeBaseUrl(config.baseUrl);
  const t1 = Date.now();
  try {
    const res = await fetchWithTimeout(
      `${base}/api/v3/sms`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${config.apiToken}`,
          Accept: "application/json",
        },
      },
      20_000,
    );
    const text = await res.text();
    let json: Record<string, unknown> = {};
    try {
      json = JSON.parse(text) as Record<string, unknown>;
    } catch {
      steps.push({
        step: "authenticate",
        ok: false,
        durationMs: Date.now() - t1,
        httpStatus: res.status,
        message: `Non-JSON response: ${text.slice(0, 200)}`,
      });
      return { ok: false, status: "ERROR", message: "Dhambaal returned an unexpected response.", steps, testedAt };
    }

    const okStatus = res.ok && String(json.status ?? "").toLowerCase() === "success";
    steps.push({
      step: "authenticate",
      ok: okStatus,
      durationMs: Date.now() - t1,
      httpStatus: res.status,
      message: okStatus
        ? "Token accepted."
        : String(json.message ?? `HTTP ${res.status}`),
      detail: json,
    });

    if (!okStatus) {
      return {
        ok: false,
        status: res.status === 401 || res.status === 403 ? "DISCONNECTED" : "ERROR",
        message: String(json.message ?? `Dhambaal rejected the request (HTTP ${res.status}).`),
        steps,
        testedAt,
      };
    }

    return {
      ok: true,
      status: "CONNECTED",
      message: "Connected to Dhambaal SMS API. Token accepted.",
      steps,
      testedAt,
    };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Connection test timed out after 20s."
          : e.message
        : "Connection test failed.";
    steps.push({ step: "authenticate", ok: false, durationMs: Date.now() - t1, message: msg });
    return { ok: false, status: "ERROR", message: msg, steps, testedAt };
  }
}

export async function dhambaalSendSms(
  config: DhambaalConfig,
  req: DhambaalSendRequest,
): Promise<DhambaalSendResult> {
  if (!config.apiToken?.trim()) {
    return { ok: false, error: "Dhambaal API token is not configured." };
  }

  const mobile = normalizeSomaliPhone(req.mobile);
  if (mobile.length < 9) {
    return { ok: false, error: `Invalid phone number: ${req.mobile}` };
  }

  const base = normalizeBaseUrl(config.baseUrl);
  const payload = {
    recipient: mobile,
    sender_id: req.senderid.slice(0, 11),
    type: "plain",
    message: req.message,
  };

  try {
    const res = await fetchWithTimeout(
      `${base}/api/v3/sms/send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.apiToken}`,
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
      return { ok: false, error: `Invalid Dhambaal response: ${text.slice(0, 200)}`, raw: text };
    }

    const status = String(json.status ?? "").toLowerCase();
    const ok = res.ok && status === "success";

    if (!ok) {
      return {
        ok: false,
        error: String(json.message ?? `Dhambaal send failed (HTTP ${res.status}).`),
        raw: json,
      };
    }

    // Docs don't pin down the exact shape of `data` for a send response —
    // pull an id/uid opportunistically if present, without depending on it.
    const data = json.data as Record<string, unknown> | string | undefined;
    const messageId =
      typeof data === "object" && data
        ? String(data.uid ?? data.id ?? "") || undefined
        : undefined;

    return {
      ok: true,
      messageId,
      totalSms: 1,
      raw: json,
    };
  } catch (e) {
    const msg =
      e instanceof Error
        ? e.name === "AbortError"
          ? "Dhambaal SMS request timed out."
          : e.message
        : "Dhambaal SMS request failed.";
    return { ok: false, error: msg };
  }
}
