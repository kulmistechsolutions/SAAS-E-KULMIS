export type PromotionType = "INDIVIDUAL" | "CLASS" | "SCHOOL_WIDE";

export interface PromotionRecord {
  id: string;
  studentId: string;
  studentCode: string;
  studentName: string;
  type: PromotionType;
  fromAcademicYear: string;
  fromClass: string;
  fromSection: string | null;
  toAcademicYear: string;
  toClass: string;
  toSection: string | null;
  graduated: boolean;
  promotedAt: string;
  promotedBy: string;
  /** Set when this record has been rolled back. */
  rolledBackAt?: string | null;
}

export interface PromotionSettings {
  requirePublishedResults: boolean;
  requireNoOutstandingFees: boolean;
  requireMinimumPass: boolean;
  requireClearance: boolean;
}

export interface PromotionAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  at: string;
  detail?: string;
}

export interface PromotionsState {
  history: PromotionRecord[];
  settings: PromotionSettings;
  audit: PromotionAuditEntry[];
}

export interface EligibilityIssue {
  code:
    | "INACTIVE"
    | "GRADUATED"
    | "NO_RESULTS"
    | "FAILED"
    | "OUTSTANDING_FEES"
    | "BLOCKED"
    | "ALREADY_PROMOTED";
  label: string;
}

export interface PromotionCandidate {
  studentId: string;
  studentCode: string;
  studentName: string;
  gender: string;
  currentClass: string;
  currentSection: string | null;
  eligible: boolean;
  graduating: boolean;
  outstandingFees: number;
  issues: EligibilityIssue[];
}

export interface PromotionPreview {
  fromClass: string;
  fromSection: string | null;
  toClass: string | null;
  toSection: string | null;
  graduating: boolean;
  total: number;
  eligible: number;
  ineligible: number;
  candidates: PromotionCandidate[];
}

export interface PromotionDashboardSummary {
  currentAcademicYear: string;
  eligibleForPromotion: number;
  totalPromoted: number;
  totalGraduated: number;
  totalInactive: number;
  pendingPromotions: number;
  lastPromotionDate: string | null;
}

export interface GraduatedStudentRow {
  studentId: string;
  studentCode: string;
  studentName: string;
  parentName: string;
  graduationYear: string;
  finalClass: string;
  finalSection: string | null;
  graduationDate: string | null;
}
