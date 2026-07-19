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
  plan: {
    id: string;
    name: string;
    maxStudents: number | null;
    maxTeachers: number | null;
    durationDays: number;
    aiGradingMonthlyQuota: number | null;
    priceUsd: number | string | null;
    isActive: boolean;
  } | null;
  assignedByUsername: string | null;
  assignedAt: string | null;
}
