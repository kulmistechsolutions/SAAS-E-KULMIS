import { api } from "@/lib/api";
import type {
  SubscriptionExtendPreview,
  SubscriptionExtendResource,
  SubscriptionExtensionOrderRow,
} from "./types";

export type SubscriptionPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export type BillingCycle = "MONTHLY" | "YEARLY";

export interface AvailableSubscriptionPlan {
  id: string;
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  durationDays: number;
  aiGradingMonthlyQuota: number | null;
  priceUsd: string | number | null;
  /** Monthly rate per student. When set, drives the price instead of priceUsd. */
  pricePerStudentUsd: string | number | null;
  /** What this school would actually pay right now, computed off its live student count. */
  computedMonthlyPriceUsd: number | null;
  computedYearlyPriceUsd: number | null;
  isActive: boolean;
  extendPricePerStudentUsd: string | number | null;
  extendPricePerTeacherUsd: string | number | null;
  extendPricePerAiCreditUsd: string | number | null;
}

export interface SubscriptionPaymentReceipt {
  id: string;
  referenceId: string;
  invoiceId: string;
  receiptNumber: string | null;
  status: SubscriptionPaymentStatus;
  amount: string | number;
  currency: string;
  billingCycle: BillingCycle;
  studentCountAtPurchase: number | null;
  channel: string;
  paymentMethod: string;
  payerAccount: string | null;
  hppUrl: string | null;
  waafiTransactionId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  activatedAt: string | null;
  expiresAt: string | null;
  createdAt: string;
  plan: {
    id: string;
    name: string;
    maxStudents: number | null;
    maxTeachers: number | null;
    durationDays: number;
    aiGradingMonthlyQuota: number | null;
  };
  auditLogs: {
    id: string;
    action: string;
    success: boolean;
    message: string;
    createdAt: string;
  }[];
}

export interface SubscriptionPaymentOrderRow {
  id: string;
  referenceId: string;
  receiptNumber: string | null;
  status: SubscriptionPaymentStatus;
  amount: string | number;
  currency: string;
  channel: string;
  payerAccount: string | null;
  hppUrl: string | null;
  waafiTransactionId: string | null;
  failureReason: string | null;
  paidAt: string | null;
  createdAt: string;
  plan: { id: string; name: string; priceUsd: string | number | null };
}

export const apiSubscriptionPlans = () =>
  api<AvailableSubscriptionPlan[]>("/subscriptions/plans");

export const apiPurchaseSubscriptionPlan = (body: {
  planId: string;
  payerAccount?: string;
  channel?: "API_PURCHASE" | "HPP_PURCHASE";
  paymentMethod?: string;
  billingCycle?: BillingCycle;
}) =>
  api<SubscriptionPaymentReceipt>("/subscriptions/purchase", {
    method: "POST",
    body,
  });

export const apiSubscriptionPaymentOrders = () =>
  api<SubscriptionPaymentOrderRow[]>("/subscriptions/payments");

export const apiSubscriptionPaymentReceipt = (id: string) =>
  api<SubscriptionPaymentReceipt>(`/subscriptions/payments/${id}`);

export const apiVerifySubscriptionPayment = (id: string) =>
  api<SubscriptionPaymentReceipt>(`/subscriptions/payments/${id}/verify`, {
    method: "POST",
  });

// ── Extend — self-service mid-cycle capacity top-up ────────────────────

export const apiPreviewSubscriptionExtend = (body: {
  resource: SubscriptionExtendResource;
  quantity: number;
}) =>
  api<SubscriptionExtendPreview>("/subscriptions/extend/preview", {
    method: "POST",
    body,
  });

export const apiPurchaseSubscriptionExtend = (body: {
  resource: SubscriptionExtendResource;
  quantity: number;
  payerAccount?: string;
  channel?: "API_PURCHASE" | "HPP_PURCHASE";
  paymentMethod?: string;
}) =>
  api<SubscriptionExtensionOrderRow>("/subscriptions/extend", {
    method: "POST",
    body,
  });

export const apiSubscriptionExtensionOrders = () =>
  api<SubscriptionExtensionOrderRow[]>("/subscriptions/extensions");

export const apiSubscriptionExtensionReceipt = (id: string) =>
  api<SubscriptionExtensionOrderRow>(`/subscriptions/extensions/${id}`);

export const apiVerifySubscriptionExtension = (id: string) =>
  api<SubscriptionExtensionOrderRow>(`/subscriptions/extensions/${id}/verify`, {
    method: "POST",
  });
