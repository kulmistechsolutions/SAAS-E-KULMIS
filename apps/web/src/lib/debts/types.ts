export type SchoolDebtStatus = "OPEN" | "SETTLED" | "CANCELLED";

export interface SchoolDebt {
  id: string;
  lender: string;
  purpose: string | null;
  principal: number;
  reference: string | null;
  takenAt: string;
  dueAt: string | null;
  status: SchoolDebtStatus;
  note: string | null;
  recordedByUserId: string | null;
  repaid: number;
  outstanding: number;
  repaymentCount: number;
  lastRepaidAt: string | null;
  overdue: boolean;
}

export interface DebtRepayment {
  id: string;
  debtId: string;
  amount: number;
  method: string | null;
  reference: string | null;
  note: string | null;
  paidAt: string;
  recordedByUserId: string | null;
  recordedBy: string | null;
}

export interface SchoolDebtDetail extends SchoolDebt {
  recordedBy: string | null;
  repayments: DebtRepayment[];
}

export interface DebtsSummary {
  debts: number;
  open: number;
  settled: number;
  borrowed: number;
  repaid: number;
  outstanding: number;
  repaidInPeriod: number;
}
