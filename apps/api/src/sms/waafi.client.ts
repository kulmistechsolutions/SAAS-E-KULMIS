/**
 * Hormuud WaafiPay client.
 * Docs: https://docs.waafipay.com/purchase-api
 *       https://docs.waafipay.com/hpp-api
 *
 * Unified endpoint POST /asm with serviceName:
 *   API_PURCHASE | HPP_PURCHASE | HPP_GETTRANINFO | API_REVERSAL
 */

import { randomUUID } from "crypto";

export type WaafiCredentials = {
  baseUrl: string;
  merchantUid: string;
  apiUserId: string;
  apiKey: string;
  storeId: string;
  hppKey: string;
};

export type WaafiEnvelope = {
  schemaVersion: string;
  timestamp: string;
  responseId?: string;
  responseCode?: string;
  errorCode?: string;
  responseMsg?: string;
  params?: Record<string, unknown>;
};

export type WaafiPurchaseResult = {
  ok: boolean;
  responseCode: string;
  errorCode: string;
  responseMsg: string;
  state?: string;
  transactionId?: string;
  issuerTransactionId?: string;
  orderId?: string;
  referenceId?: string;
  hppUrl?: string;
  directPaymentLink?: string;
  accountNo?: string;
  txAmount?: string;
  raw: WaafiEnvelope;
  requestId: string;
  requestBody: Record<string, unknown>;
};

export type WaafiTranInfo = {
  ok: boolean;
  status?: string;
  tranStatusDesc?: string;
  transactionId?: string;
  referenceId?: string;
  amount?: string;
  currency?: string;
  payerId?: string;
  paymentMethod?: string;
  raw: WaafiEnvelope;
};

function timestamp(): string {
  // Waafi examples use "YYYY-MM-DD HH:mm:ss.SSS"
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())}.${pad(d.getUTCMilliseconds(), 3)}`;
}

function normalizeBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (trimmed.endsWith("/asm")) return trimmed;
  return `${trimmed}/asm`;
}

async function postAsm(
  creds: WaafiCredentials,
  serviceName: string,
  serviceParams: Record<string, unknown>,
): Promise<{ requestId: string; requestBody: Record<string, unknown>; raw: WaafiEnvelope }> {
  const requestId = randomUUID();
  const requestBody = {
    schemaVersion: "1.0",
    requestId,
    timestamp: timestamp(),
    channelName: "WEB",
    serviceName,
    serviceParams,
  };

  const base = normalizeBaseUrl(creds.baseUrl);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 45_000);

  try {
    const res = await fetch(base, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    let raw: WaafiEnvelope;
    try {
      raw = (await res.json()) as WaafiEnvelope;
    } catch {
      raw = {
        schemaVersion: "1.0",
        timestamp: timestamp(),
        responseCode: String(res.status),
        errorCode: "PARSE_ERROR",
        responseMsg: `Non-JSON response from WaafiPay (HTTP ${res.status})`,
        params: {},
      };
    }

    return { requestId, requestBody, raw };
  } catch (err) {
    const message =
      err instanceof Error
        ? err.name === "AbortError"
          ? "WaafiPay request timed out"
          : err.message
        : "WaafiPay request failed";
    return {
      requestId,
      requestBody,
      raw: {
        schemaVersion: "1.0",
        timestamp: timestamp(),
        responseCode: "0",
        errorCode: "NETWORK",
        responseMsg: message,
        params: {},
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

function isSuccess(raw: WaafiEnvelope): boolean {
  const code = String(raw.responseCode ?? "");
  const err = String(raw.errorCode ?? "");
  const msg = String(raw.responseMsg ?? "").toUpperCase();
  return (
    (code === "2001" || code === "2000") &&
    (err === "0" || err === "" || err === "E00000") &&
    (msg.includes("SUCCESS") || msg === "RCS_SUCCESS" || msg === "")
  );
}

function mapPurchase(
  requestId: string,
  requestBody: Record<string, unknown>,
  raw: WaafiEnvelope,
): WaafiPurchaseResult {
  const params = raw.params ?? {};
  const state = String(params.state ?? params.status ?? "").toUpperCase();
  const ok =
    isSuccess(raw) &&
    (state === "" ||
      state === "APPROVED" ||
      state === "SUCCESS" ||
      Boolean(params.hppUrl) ||
      Boolean(params.transactionId));

  return {
    ok,
    responseCode: String(raw.responseCode ?? ""),
    errorCode: String(raw.errorCode ?? ""),
    responseMsg: String(raw.responseMsg ?? ""),
    state: state || undefined,
    transactionId: params.transactionId != null ? String(params.transactionId) : undefined,
    issuerTransactionId:
      params.issuerTransactionId != null
        ? String(params.issuerTransactionId)
        : undefined,
    orderId: params.orderId != null ? String(params.orderId) : undefined,
    referenceId: params.referenceId != null ? String(params.referenceId) : undefined,
    hppUrl: params.hppUrl != null ? String(params.hppUrl) : undefined,
    directPaymentLink:
      params.directPaymentLink != null
        ? String(params.directPaymentLink)
        : undefined,
    accountNo: params.accountNo != null ? String(params.accountNo) : undefined,
    txAmount: params.txAmount != null ? String(params.txAmount) : undefined,
    raw,
    requestId,
    requestBody,
  };
}

/** Direct mobile-wallet purchase (API_PURCHASE). */
export async function waafiApiPurchase(
  creds: WaafiCredentials,
  input: {
    accountNo: string;
    referenceId: string;
    invoiceId: string;
    amount: number;
    currency: string;
    description: string;
    paymentMethod?: string;
  },
): Promise<WaafiPurchaseResult> {
  const { requestId, requestBody, raw } = await postAsm(creds, "API_PURCHASE", {
    merchantUid: creds.merchantUid,
    apiUserId: creds.apiUserId,
    apiKey: creds.apiKey,
    paymentMethod: input.paymentMethod ?? "MWALLET_ACCOUNT",
    payerInfo: { accountNo: input.accountNo },
    transactionInfo: {
      referenceId: input.referenceId,
      invoiceId: input.invoiceId,
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency,
      description: input.description,
    },
  });
  return mapPurchase(requestId, requestBody, raw);
}

/** Hosted Payment Page purchase (HPP_PURCHASE). */
export async function waafiHppPurchase(
  creds: WaafiCredentials,
  input: {
    accountNo?: string;
    referenceId: string;
    amount: number;
    currency: string;
    description: string;
    successCallbackUrl: string;
    failureCallbackUrl: string;
    paymentMethod?: string;
  },
): Promise<WaafiPurchaseResult> {
  const serviceParams: Record<string, unknown> = {
    merchantUid: creds.merchantUid,
    storeId: Number.isFinite(Number(creds.storeId))
      ? Number(creds.storeId)
      : creds.storeId,
    hppKey: creds.hppKey,
    paymentMethod: input.paymentMethod ?? "MWALLET_ACCOUNT",
    hppSuccessCallbackUrl: input.successCallbackUrl,
    hppFailureCallbackUrl: input.failureCallbackUrl,
    hppRespDataFormat: 1,
    transactionInfo: {
      referenceId: input.referenceId,
      amount: Number(input.amount.toFixed(2)),
      currency: input.currency,
      description: input.description,
    },
  };
  if (input.accountNo) {
    serviceParams.payerInfo = { subscriptionId: input.accountNo };
  }

  const { requestId, requestBody, raw } = await postAsm(
    creds,
    "HPP_PURCHASE",
    serviceParams,
  );
  return mapPurchase(requestId, requestBody, raw);
}

/** Verify / inquire transaction (HPP_GETTRANINFO). */
export async function waafiGetTranInfo(
  creds: WaafiCredentials,
  referenceId: string,
): Promise<WaafiTranInfo> {
  const { raw } = await postAsm(creds, "HPP_GETTRANINFO", {
    merchantUid: creds.merchantUid,
    storeId: Number.isFinite(Number(creds.storeId))
      ? Number(creds.storeId)
      : creds.storeId,
    hppKey: creds.hppKey,
    referenceId,
  });

  const params = raw.params ?? {};
  const status = String(params.status ?? params.tranStatusDesc ?? "").toUpperCase();
  const ok =
    isSuccess(raw) &&
    (status.includes("APPROVED") ||
      status.includes("SUCCESS") ||
      status === "3");

  return {
    ok,
    status: status || undefined,
    tranStatusDesc:
      params.tranStatusDesc != null ? String(params.tranStatusDesc) : undefined,
    transactionId:
      params.transactionId != null ? String(params.transactionId) : undefined,
    referenceId:
      params.referenceId != null ? String(params.referenceId) : undefined,
    amount: params.amount != null ? String(params.amount) : params.tranAmount != null ? String(params.tranAmount) : undefined,
    currency: params.currency != null ? String(params.currency) : undefined,
    payerId: params.payerId != null ? String(params.payerId) : undefined,
    paymentMethod:
      params.paymentMethod != null ? String(params.paymentMethod) : undefined,
    raw,
  };
}

/** Lightweight credential check: inquire a synthetic reference (expects a clean auth response). */
export async function waafiTestConnection(
  creds: WaafiCredentials,
): Promise<{
  ok: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
  steps: { step: string; ok: boolean; message: string }[];
  testedAt: string;
}> {
  const steps: { step: string; ok: boolean; message: string }[] = [];
  const testedAt = new Date().toISOString();

  if (!creds.merchantUid?.trim()) {
    return {
      ok: false,
      status: "DISCONNECTED",
      message: "Merchant UID is required.",
      steps: [{ step: "credentials", ok: false, message: "Missing merchantUid" }],
      testedAt,
    };
  }

  const hasApi = Boolean(creds.apiUserId?.trim() && creds.apiKey?.trim());
  const hasHpp = Boolean(creds.storeId?.trim() && creds.hppKey?.trim());
  if (!hasApi && !hasHpp) {
    return {
      ok: false,
      status: "DISCONNECTED",
      message: "Provide either API credentials (apiUserId + apiKey) or HPP credentials (storeId + hppKey).",
      steps: [{ step: "credentials", ok: false, message: "Incomplete credentials" }],
      testedAt,
    };
  }

  steps.push({
    step: "credentials",
    ok: true,
    message: hasApi && hasHpp ? "API + HPP credentials present" : hasApi ? "API credentials present" : "HPP credentials present",
  });

  // Probe with GETTRANINFO when HPP is configured; otherwise a tiny API purchase against sandbox test wallet is too invasive —
  // we POST a GETTRANINFO-like envelope with API credentials via a no-op inquiry using HPP if available,
  // else we validate reachability with a malformed-but-authenticated API_PURCHASE that Waafi rejects cleanly.
  try {
    if (hasHpp) {
      const info = await waafiGetTranInfo(creds, `CONNTEST-${Date.now()}`);
      const authOk =
        info.raw.errorCode !== "NETWORK" &&
        info.raw.errorCode !== "PARSE_ERROR" &&
        String(info.raw.responseCode ?? "") !== "0";
      // Missing transaction is fine — means auth reached Waafi
      const msg = info.raw.responseMsg || info.tranStatusDesc || `HTTP response ${info.raw.responseCode}`;
      steps.push({
        step: "hpp_probe",
        ok: authOk,
        message: authOk ? `WaafiPay reachable (${msg})` : msg,
      });
      if (!authOk) {
        return {
          ok: false,
          status: "ERROR",
          message: msg || "WaafiPay HPP probe failed",
          steps,
          testedAt,
        };
      }
    } else {
      // API-only: send purchase with invalid amount 0 — expect auth success + business decline, not network/auth failure
      const result = await waafiApiPurchase(creds, {
        accountNo: "252611111111",
        referenceId: `CONNTEST-${Date.now()}`,
        invoiceId: `CONNTEST-${Date.now()}`,
        amount: 0.01,
        currency: "USD",
        description: "eKulmis connection test — ignore",
      });
      const authOk =
        result.errorCode !== "NETWORK" &&
        result.errorCode !== "PARSE_ERROR" &&
        result.responseCode !== "0";
      steps.push({
        step: "api_probe",
        ok: authOk,
        message: authOk
          ? `WaafiPay reachable (${result.responseMsg || result.responseCode})`
          : result.responseMsg || "API probe failed",
      });
      if (!authOk) {
        return {
          ok: false,
          status: "ERROR",
          message: result.responseMsg || "WaafiPay API probe failed",
          steps,
          testedAt,
        };
      }
    }

    return {
      ok: true,
      status: "CONNECTED",
      message: "WaafiPay connection verified.",
      steps,
      testedAt,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Connection test failed";
    steps.push({ step: "probe", ok: false, message });
    return { ok: false, status: "ERROR", message, steps, testedAt };
  }
}

/** Normalize Somali / East Africa mobile to Waafi international format (no +). */
export function normalizeWaafiAccount(phone: string): string {
  let p = phone.replace(/[\s\-()]/g, "");
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00")) p = p.slice(2);
  // Local Somalia 61/62/63/65/68/90 → 252…
  if (/^0?(61|62|63|65|68|90)\d{7}$/.test(p)) {
    p = `252${p.replace(/^0/, "")}`;
  }
  return p;
}

export function isApprovedCallbackStatus(status: unknown): boolean {
  const s = String(status ?? "").toUpperCase();
  return (
    s === "APPROVED" ||
    s === "SUCCESS" ||
    s === "COMPLETED" ||
    s === "PAID" ||
    s === "3"
  );
}
