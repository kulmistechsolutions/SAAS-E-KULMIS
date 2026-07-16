export type SettingsSectionKey =
  | "school"
  | "branding"
  | "academic"
  | "students"
  | "teachers"
  | "parents"
  | "examinations"
  | "grades"
  | "fees"
  | "salary"
  | "expenses"
  | "attendance"
  | "quiz"
  | "notifications"
  | "email"
  | "security"
  | "backup"
  | "license";

export interface GradeBand {
  min: number;
  max: number;
  grade: string;
}

export interface SchoolSettings {
  name: string;
  motto: string;
  logoDataUrl: string | null;
  address: string;
  city: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  principalName: string;
  academicYear: string;
  currency: string;
  timezone: string;
  language: string;
  /** "LEFT" (logo beside the school name) or "CENTERED" (logo above it), applied to every printed document. */
  documentHeaderLayout: "LEFT" | "CENTERED";
  reportHeader: string;
  reportFooter: string;
}

export interface BrandingSettings {
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  faviconDataUrl: string | null;
  loginBackgroundDataUrl: string | null;
  loginTitle: string;
  footerText: string;
}

export interface AcademicSettings {
  activeAcademicYear: string;
  schoolLevel: string;
  passingPercentage: number;
  gradeScale: string;
  defaultAttendanceStatus: "PRESENT" | "ABSENT";
  graduationClass: string;
  autoPromote: boolean;
}

export interface StudentSettings {
  idPrefix: string;
  startingNumber: number;
  idLength: number;
  portalLoginEnabled: boolean;
  requirePhone: boolean;
  allowPhotoUpload: boolean;
  studentHeader: string;
  studentFooter: string;
}

export interface TeacherSettings {
  idPrefix: string;
  defaultPassword: string;
  portalEnabled: boolean;
  /** When true, new teachers get canViewStudents on registration. */
  defaultViewStudents: boolean;
  morningShiftStart: string;
  afternoonShiftStart: string;
  teacherHeader: string;
  teacherFooter: string;
}

export interface ParentSettings {
  idPrefix: string;
  portalEnabled: boolean;
  autoAccountCreation: boolean;
  usernameFormat: "FIRST_NAME" | "FIRST_NAME_CODE";
  defaultPassword: string;
  parentHeader: string;
  parentFooter: string;
}

export interface ExaminationSettings {
  maxTerms: number;
  defaultExamStatus: string;
  passingPercentage: number;
  resultPublishing: boolean;
  resultLocking: boolean;
  studentResultPortal: boolean;
  parentResultPortal: boolean;
  publicResultPortal: boolean;
  blockResultFeature: boolean;
}

export interface FeeSettings {
  monthlyFeeSystem: boolean;
  billingMode: "MONTHLY" | "ACADEMIC_YEAR";
  monthSetupDay: number;
  academicMonths: number;
  billingStartMonth: number;
  billingEndMonth: number;
  allowPartialPayment: boolean;
  allowAdvancePayment: boolean;
  carryForward: boolean;
  currencySymbol: string;
  receiptPrefix: string;
  receiptHeader: string;
  receiptFooter: string;
}

export interface SalarySettings {
  payrollDay: number;
  allowPartialSalary: boolean;
  currency: string;
  payslipHeader: string;
  payslipFooter: string;
}

export interface ExpenseSettings {
  approvalWorkflow: boolean;
  defaultCategories: string[];
  attachmentSizeLimitMb: number;
  expenseHeader: string;
  expenseFooter: string;
}

export interface AttendanceSettings {
  startTime: string;
  endTime: string;
  lateTime: string;
  excusedEnabled: boolean;
  lockTime: string;
}

export interface QuizSettings {
  maxAttempts: number;
  autoSubmit: boolean;
  autoSave: boolean;
  showResultsImmediately: boolean;
  questionRandomization: boolean;
}

export interface NotificationEventFlags {
  newStudent: boolean;
  feeCollection: boolean;
  examPublished: boolean;
  quizPublished: boolean;
  attendanceAlert: boolean;
  resultPublished: boolean;
}

export interface NotificationSettings {
  inApp: boolean;
  email: boolean;
  sms: boolean;
  whatsapp: boolean;
  events: NotificationEventFlags;
}

export interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  senderName: string;
  senderEmail: string;
}

export interface SecuritySettingsConfig {
  minPasswordLength: number;
  requireComplexity: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
  sessionTimeoutMinutes: number;
  loginAttemptLimit: number;
  twoFactorEnabled: boolean;
  ipRestriction: string;
}

export interface BackupSettings {
  dailyAuto: boolean;
  weeklyAuto: boolean;
  monthlyAuto: boolean;
  retentionDays: number;
  location: string;
  lastBackupAt: string | null;
}

export interface LicenseSettings {
  licenseKey: string;
  active: boolean;
  expiresAt: string;
}

export interface SystemInfo {
  systemName: string;
  version: string;
  buildNumber: string;
  installationDate: string;
  databaseType: string;
  serverTime: string;
}

export type SettingsAuditAction =
  | "SCHOOL_UPDATED"
  | "BRANDING_CHANGED"
  | "ACADEMIC_UPDATED"
  | "FEE_UPDATED"
  | "EXAM_UPDATED"
  | "SECURITY_UPDATED"
  | "BACKUP_CREATED"
  | "BACKUP_RESTORED"
  | "LOGO_CHANGED"
  | "SMTP_UPDATED"
  | "SETTINGS_RESET"
  | "SETTINGS_IMPORTED";

export interface SettingsAuditEntry {
  id: string;
  action: SettingsAuditAction;
  user: string;
  role: string;
  detail?: string;
  at: string;
  ipAddress: string;
}

export interface SettingsState {
  school: SchoolSettings;
  branding: BrandingSettings;
  academic: AcademicSettings;
  students: StudentSettings;
  teachers: TeacherSettings;
  parents: ParentSettings;
  examinations: ExaminationSettings;
  grades: GradeBand[];
  fees: FeeSettings;
  salary: SalarySettings;
  expenses: ExpenseSettings;
  attendance: AttendanceSettings;
  quiz: QuizSettings;
  notifications: NotificationSettings;
  email: EmailSettings;
  security: SecuritySettingsConfig;
  backup: BackupSettings;
  license: LicenseSettings;
  system: SystemInfo;
  audit: SettingsAuditEntry[];
  backups: { id: string; label: string; createdAt: string; data: string }[];
}

export interface SettingsDashboardSummary {
  schoolName: string;
  activeAcademicYear: string;
  parentPortalEnabled: boolean;
  studentPortalEnabled: boolean;
  lastBackupAt: string | null;
  licenseActive: boolean;
  categoriesConfigured: number;
}
