export interface SchoolSubscriptionMe {
  status: string;
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
  aiGradingUsed: number;
  aiLimit: number | null;
  aiRemaining: number | null;
  plan: {
    id: string;
    name: string;
    maxStudents: number | null;
    durationDays: number;
    aiGradingMonthlyQuota: number | null;
    priceUsd: number | string | null;
    isActive: boolean;
  } | null;
  assignedByUsername: string | null;
  assignedAt: string | null;
}
