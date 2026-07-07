export type FeeChargeStatus = "UNPAID" | "PARTIAL" | "PAID" | "ADVANCE";

export type PaymentType = "THIS_MONTH" | "PARTIAL" | "ADVANCE";

export interface FeeCharge {
  id: string;
  studentId: string;
  academicYear: string;
  monthKey: string;
  monthlyFee: number;
  amountPaid: number;
  balance: number;
  status: FeeChargeStatus;
  paymentDate: string | null;
  /** Covered by an advance payment — no new charge due. */
  advanceCovered?: boolean;
}

export interface FeePayment {
  id: string;
  receiptNo: string;
  studentId: string;
  academicYear: string;
  amount: number;
  paymentType: PaymentType;
  advanceMonths?: number;
  monthKeys: string[];
  collectedBy: string;
  collectedAt: string;
  outstandingAfter: number;
}

export interface BillingPeriod {
  id: string;
  academicYear: string;
  monthKey: string;
  activatedAt: string;
  status: "ACTIVE" | "CLOSED";
}

export interface FeeAuditEntry {
  id: string;
  action: string;
  user: string;
  at: string;
  detail?: string;
}

export interface FeesState {
  academicYear: string;
  activeMonthKey: string;
  billingPeriods: BillingPeriod[];
  charges: FeeCharge[];
  payments: FeePayment[];
  receiptSeq: number;
  audit: FeeAuditEntry[];
}

export interface FeeDashboardSummary {
  totalOutstanding: number;
  outstandingThisMonth: number;
  collectedToday: number;
  collectedThisMonth: number;
  collectionPercentage: number;
  fullyPaidStudents: number;
  partialPayments: number;
  advancePayments: number;
  expectedMonthlyIncome: number;
  netFeeCollection: number;
  totalActiveStudents: number;
}

export interface StudentFeeRow {
  studentId: string;
  code: string;
  fullName: string;
  className: string;
  section: string;
  monthlyFee: number;
  outstandingBalance: number;
  status: FeeChargeStatus | "ADVANCE_MULTI";
  advanceMonthsLeft?: number;
}

export interface RecentPaymentRow {
  payment: FeePayment;
  studentCode: string;
  studentName: string;
  className: string;
  section: string;
}

export interface StudentLedgerRow {
  monthKey: string;
  monthLabel: string;
  monthlyCharge: number;
  amountPaid: number;
  remainingBalance: number;
  status: FeeChargeStatus;
  paymentDate: string | null;
  chargeId: string;
}

export interface PaymentSummarySlice {
  name: string;
  value: number;
  color: string;
  amount: number;
  percent: number;
}
