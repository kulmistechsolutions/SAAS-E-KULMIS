import { api } from "@/lib/api";

export type SubscriptionPaymentStatus =
  | "PENDING"
  | "PROCESSING"
  | "SUCCESS"
  | "FAILED"
  | "EXPIRED"
  | "CANCELLED";

export interface AvailableSubscriptionPlan {
  id: string;
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  durationDays: number;
  aiGradingMonthlyQuota: number | null;
  priceUsd: string | number | null;
  isActive: boolean;
}

export interface SubscriptionPaymentReceipt {
  id: string;
  referenceId: string;
  invoiceId: string;
  receiptNumber: string | null;
  status: SubscriptionPaymentStatus;
  amount: string | number;
  currency: string;
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
