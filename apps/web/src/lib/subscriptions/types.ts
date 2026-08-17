export interface SchoolSubscriptionMe {
  status: string;
  /** True while the school is running on its free trial (no plan assigned yet). */
  isTrial?: boolean;
  trialEndsAt?: string | null;
  banner: {
    tone: "green" | "orange" | "red";
    message: string;
  };
  startDate: string | null;
  endDate: string | null;
  billingCycle?: "MONTHLY" | "YEARLY";
  daysRemaining: number | null;
  studentCount: number;
  studentLimit: number | null;
  studentsRemaining: number | null;
  teacherCount: number;
  teacherLimit: number | null;
  teachersRemaining: number | null;
  aiGradingUsed: number;
  aiLimit: number | null;
  aiRemaining: number | null;
  extraStudents?: number;
  extraTeachers?: number;
  extraAiGradingQuota?: number;
  canExtendStudents?: boolean;
  canExtendTeachers?: boolean;
  canExtendAiGrading?: boolean;
  plan: {
    id: string;
    name: string;
    maxStudents: number | null;
    maxTeachers: number | null;
    durationDays: number;
    aiGradingMonthlyQuota: number | null;
    priceUsd: number | string | null;
    isActive: boolean;
    extendPricePerStudentUsd?: number | string | null;
    extendPricePerTeacherUsd?: number | string | null;
    extendPricePerAiCreditUsd?: number | string | null;
  } | null;
  assignedByUsername: string | null;
  assignedAt: string | null;
}

export type SubscriptionExtendResource = "STUDENT" | "TEACHER" | "AI_GRADING";

export interface SubscriptionExtendPreview {
  resource: SubscriptionExtendResource;
  quantity: number;
  unitPriceUsd: number | string;
  cycleTotalDays: number;
  cycleRemainingDays: number;
  amount: number | string;
  currency: string;
}

export interface SubscriptionExtensionOrderRow {
  id: string;
  referenceId: string;
  invoiceId: string;
  receiptNumber: string | null;
  status: string;
  resource: SubscriptionExtendResource;
  quantity: number;
  unitPriceUsd: number | string;
  cycleTotalDays: number;
  cycleRemainingDays: number;
  amount: number | string;
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
  plan: { id: string; name: string };
}
