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
    package: { id: string; name: string; credits: number; price: string | number };
  }[];
  deliveryStats: { status: string; count: number; credits: number }[];
}

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

export async function apiSmsSettings(body: {
  smsSenderName?: string | null;
  smsEnabled?: boolean;
}) {
  return api("/sms/settings", { method: "PATCH", body });
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

export async function apiCreateSmsTemplate(body: {
  name: string;
  category: SmsCategory;
  body: string;
}) {
  return api<SmsTemplate>("/sms/templates", { method: "POST", body });
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
  recipients: { phone: string; name?: string; type?: string }[];
  scheduledAt?: string | null;
}) {
  return api<{
    sent: number;
    failed: number;
    queued: number;
    creditsUsed: number;
  }>("/sms/send", { method: "POST", body });
}

export async function apiSendAudienceSms(body: {
  category?: SmsCategory;
  body: string;
  audience:
    | "ALL_PARENTS"
    | "CLASS"
    | "SECTION"
    | "TEACHERS"
    | "OUTSTANDING"
    | "CUSTOM";
  classId?: string | null;
  sectionId?: string | null;
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
  package: { id: string; name: string; credits: number; price: string | number };
  purchase: {
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    status: string;
  } | null;
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
