export type FeeChargeStatus = "UNPAID" | "PARTIAL" | "PAID" | "ADVANCE" | "INACTIVE";

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
  /** MONTHLY = the regular fee; EXTRA = an added charge such as an exam fee. */
  kind?: "MONTHLY" | "EXTRA" | "REGISTRATION";
  /** Name shown on the invoice for EXTRA rows, e.g. "Exam Fee". */
  label?: string | null;
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
  /** ACTIVE is a normal payment; REVERSED means a linked reversal entry now cancels it out. */
  status?: "ACTIVE" | "REVERSED";
  /** True for the reversal entry itself — a negative-amount transaction, never editable/reversible again. */
  isReversal?: boolean;
  reversalOfPaymentId?: string | null;
  reversedAt?: string | null;
  reversalReason?: string | null;
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
  /** Never charged the monthly fee at all (waived, or registered at $0) — has
   *  no bearing on payment behavior, so it's counted apart from fullyPaid/
   *  partial/advance rather than trivially showing up as "fully paid". */
  freeStudents: number;
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
  feeWaived?: boolean;
  outstandingBalance: number;
  status: FeeChargeStatus | "ADVANCE_MULTI";
  advanceMonthsLeft?: number;
}

/** One child within a FamilyFeeRow, kept lean since the family view lists many. */
export interface FamilyChildRow {
  studentId: string;
  code: string;
  fullName: string;
  className: string;
  section: string;
  outstandingBalance: number;
  status: FeeChargeStatus | "ADVANCE_MULTI";
}

/** A parent with every active sibling grouped under them, for the Family collect view. */
export interface FamilyFeeRow {
  parentId: string;
  parentCode: string;
  parentName: string;
  parentPhone: string;
  children: FamilyChildRow[];
  totalOutstanding: number;
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
  /** MONTHLY = the regular fee; EXTRA = an added charge such as an exam fee. */
  kind?: "MONTHLY" | "EXTRA" | "REGISTRATION";
  /** Name shown on the invoice for EXTRA rows, e.g. "Exam Fee". */
  label?: string | null;
}

export interface PaymentSummarySlice {
  name: string;
  value: number;
  color: string;
  amount: number;
  percent: number;
}
