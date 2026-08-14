import { api } from "@/lib/api";

export type SmsCategory =
  | "CUSTOM"
  | "FEE_REMINDER"
  | "ANNOUNCEMENT"
  | "EMERGENCY"
  | "ATTENDANCE"
  | "EXAM_ANNOUNCEMENT"
  | "EXAM_RESULT"
  | "ADMISSION"
  | "REGISTRATION"
  | "PAYMENT_CONFIRMATION";

export interface SmsBalance {
  school: {
    id: string;
    name: string;
    smsSenderName: string | null;
    /** The name messages actually go out under — show this, not the above. */
    sendingName?: string;
    smsEnabled: boolean;
  };
  provider: {
    enabled: boolean;
    connected: boolean;
    status: string;
    message: string;
    canSend: boolean;
  };
  creditsRemaining: number;
  purchases: {
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    amountPaid: string | number;
    currency: string;
    status: string;
    purchasedAt: string;
    package: {
      id: string;
      name: string;
      credits: number;
      price: string | number;
    };
  }[];
  /** Own-gateway state; when active, credits are not consumed. */
  gateway?: {
    licensed: boolean;
    active: boolean;
    enabled: boolean;
    connectionStatus: string;
    expiresAt: string | null;
  };
  deliveryStats: { status: string; count: number; credits: number }[];
}

// ── School's own SMS gateway (paid add-on) ─────────────────────────────────

export interface SmsGatewayLicense {
  id: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  durationMonths: number;
  price: string | number | null;
  currency: string;
  note: string | null;
  createdAt: string;
}

export interface SchoolSmsGateway {
  /** A live licence from the platform admin exists. */
  licensed: boolean;
  license: SmsGatewayLicense | null;
  history: SmsGatewayLicense[];
  enabled: boolean;
  baseUrl: string;
  username: string;
  hasPassword: boolean;
  senderId: string | null;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "ERROR";
  connectionMessage: string | null;
  connectionVerified: boolean;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  providerBalance: string | null;
  /** True when SMS actually routes through the school's own account. */
  active: boolean;
}

export interface SmsGatewayTestResult {
  ok: boolean;
  status: string;
  message: string;
  providerBalance?: string | null;
}

// Read-only for a school — entering/testing the Hormuud credentials and
// switching the gateway on/off is a Platform Super Admin action now (see
// lib/platform/api.ts), so there is no school-facing write path here.
export const apiSmsGateway = () => api<SchoolSmsGateway>("/sms/gateway");

export interface SmsTemplate {
  id: string;
  name: string;
  category: SmsCategory;
  body: string;
  isActive: boolean;
}

export interface SmsMessage {
  id: string;
  recipientPhone: string;
  recipientName: string | null;
  senderId: string;
  body: string;
  category: SmsCategory;
  status: string;
  creditsUsed: number;
  error: string | null;
  sentAt: string | null;
  createdAt: string;
}

export interface SmsPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price: string | number;
  currency: string;
  isActive: boolean;
}

export async function apiSmsBalance() {
  return api<SmsBalance>("/sms/balance");
}

/**
 * The school's own SMS switches. The sending name is NOT here — it is
 * registered with the operator against a licensed organisation, so the school
 * applies for it and the platform owner grants it (see apiSmsSenderId below).
 */
export async function apiSmsSettings(body: { smsEnabled?: boolean }) {
  return api("/sms/settings", { method: "PATCH", body });
}

/** One sender ID application. */
export interface SmsSenderIdRequest {
  id: string;
  requestedName: string;
  approvedName: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  licenseDocName: string | null;
  contactPerson: string | null;
  contactPhone: string | null;
  note: string | null;
  reviewNote: string | null;
  reviewedAt: string | null;
  createdAt: string;
}

export interface SmsSenderIdState {
  /**
   * False when the sender ID feature is switched off platform-wide, in which
   * case no other field is sent and the UI shows nothing.
   */
  available?: boolean;
  schoolName: string;
  /** The live sending name. Null until an application is approved. */
  activeSenderId: string | null;
  pending: SmsSenderIdRequest | null;
  history: SmsSenderIdRequest[];
}

export async function apiSmsSenderId() {
  return api<SmsSenderIdState>("/sms/sender-id");
}

export async function apiRequestSmsSenderId(body: {
  requestedName: string;
  contactPerson?: string | null;
  contactPhone?: string | null;
  note?: string | null;
  licenseDoc?: string | null;
  licenseDocName?: string | null;
  licenseDocMime?: string | null;
}) {
  return api<{ id: string; requestedName: string; status: string }>(
    "/sms/sender-id/request",
    { method: "POST", body },
  );
}

export async function apiSmsPackages() {
  return api<SmsPackage[]>("/sms/packages");
}

export async function apiSmsTemplates() {
  return api<SmsTemplate[]>("/sms/templates");
}

export async function apiSeedSmsTemplates() {
  return api<SmsTemplate[]>("/sms/templates/seed", { method: "POST" });
}

/** Deletes all templates for this school and reseeds the built-in defaults. */
export async function apiResetSmsTemplates() {
  return api<SmsTemplate[]>("/sms/templates/reset", { method: "POST" });
}

export async function apiCreateSmsTemplate(body: {
  name: string;
  category: SmsCategory;
  body: string;
}) {
  return api<SmsTemplate>("/sms/templates", { method: "POST", body });
}

export async function apiUpdateSmsTemplate(
  id: string,
  body: Partial<{
    name: string;
    category: SmsCategory;
    body: string;
    isActive: boolean;
  }>,
) {
  return api<SmsTemplate>(`/sms/templates/${id}`, { method: "PATCH", body });
}

export async function apiDeleteSmsTemplate(id: string) {
  return api(`/sms/templates/${id}`, { method: "DELETE" });
}

export async function apiSmsMessages(params?: {
  status?: string;
  category?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.category) qs.set("category", params.category);
  if (params?.q) qs.set("q", params.q);
  const q = qs.toString();
  return api<SmsMessage[]>(`/sms/messages${q ? `?${q}` : ""}`);
}

export async function apiSmsTransactions() {
  return api<unknown[]>("/sms/transactions");
}

export async function apiSmsCampaigns() {
  return api<unknown[]>("/sms/campaigns");
}

export async function apiSendSms(body: {
  category?: SmsCategory;
  body: string;
  templateId?: string;
  recipients: {
    phone: string;
    name?: string;
    type?: string;
    variables?: Record<string, string>;
  }[];
  scheduledAt?: string | null;
}) {
  return api<{
    sent: number;
    failed: number;
    queued: number;
    creditsUsed: number;
  }>("/sms/send", { method: "POST", body });
}

export type SmsAudience =
  "ALL_PARENTS" | "CLASS" | "SECTION" | "TEACHERS" | "OUTSTANDING" | "CUSTOM";

export interface SmsAudienceRecipient {
  recordId: string;
  refId: string | null;
  phone: string;
  name: string | null;
  type: string | null;
  variables: Record<string, string>;
}

export async function apiPreviewAudience(body: {
  audience: SmsAudience;
  classId?: string | null;
  sectionId?: string | null;
}) {
  return api<SmsAudienceRecipient[]>("/sms/preview-audience", {
    method: "POST",
    body,
  });
}

export async function apiSendAudienceSms(body: {
  category?: SmsCategory;
  body: string;
  audience: SmsAudience;
  classId?: string | null;
  sectionId?: string | null;
  studentIds?: string[];
  teacherIds?: string[];
  campaignName?: string;
  scheduledAt?: string | null;
}) {
  return api<{
    sent: number;
    failed: number;
    queued: number;
    creditsUsed: number;
    campaignId?: string;
  }>("/sms/send-audience", { method: "POST", body });
}

export async function apiFeeReminders(message?: string) {
  return api<{ sent: number; failed: number; creditsUsed: number }>(
    "/sms/fee-reminders",
    { method: "POST", body: { message } },
  );
}

// ── SMS package payments (WaafiPay) ────────────────────────────────────────

export type SmsPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "REFUNDED"
  | "CANCELLED";

export interface SmsPaymentReceipt {
  id: string;
  referenceId: string;
  invoiceId: string;
  receiptNumber: string | null;
  status: SmsPaymentStatus;
  amount: string | number;
  currency: string;
  credits: number;
  channel: string;
  paymentMethod: string;
  payerAccount: string | null;
  hppUrl: string | null;
  waafiTransactionId: string | null;
  waafiOrderId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  package: {
    id: string;
    name: string;
    credits: number;
    price: string | number;
    description: string | null;
  };
  purchase: {
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    status: string;
  } | null;
  school: { id: string; name: string; subdomain: string } | null;
  auditLogs: {
    id: string;
    action: string;
    success: boolean;
    message: string;
    createdAt: string;
  }[];
}

export interface SmsPaymentOrderRow {
  id: string;
  referenceId: string;
  receiptNumber: string | null;
  status: SmsPaymentStatus;
  amount: string | number;
  currency: string;
  credits: number;
  channel: string;
  payerAccount: string | null;
  hppUrl: string | null;
  waafiTransactionId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  package: {
    id: string;
    name: string;
    credits: number;
    price: string | number;
  };
  purchase: {
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    status: string;
  } | null;
}

export interface SmsPaymentStatusInfo {
  paymentsUnlocked: boolean;
  manualPaymentNumber: string | null;
  manualPaymentInstructions: string | null;
}

export async function apiSmsPaymentStatus() {
  return api<SmsPaymentStatusInfo>("/sms/payments/status");
}

export async function apiPurchaseSmsPackage(body: {
  packageId: string;
  payerAccount?: string;
  channel?: "API_PURCHASE" | "HPP_PURCHASE";
  paymentMethod?: string;
}) {
  return api<SmsPaymentReceipt>("/sms/payments/purchase", {
    method: "POST",
    body,
  });
}

export async function apiSmsPaymentOrders() {
  return api<SmsPaymentOrderRow[]>("/sms/payments");
}

export async function apiSmsPaymentReceipt(id: string) {
  return api<SmsPaymentReceipt>(`/sms/payments/${id}`);
}

export async function apiVerifySmsPayment(id: string) {
  return api<SmsPaymentReceipt>(`/sms/payments/${id}/verify`, {
    method: "POST",
  });
}
