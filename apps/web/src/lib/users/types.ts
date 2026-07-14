export type AccountStatus = "ACTIVE" | "INACTIVE" | "LOCKED";

export type BuiltInRole =
  | "SUPER_ADMINISTRATOR"
  | "ADMINISTRATOR"
  | "ACADEMIC_MANAGER"
  | "TEACHER"
  | "PARENT"
  | "STUDENT"
  | "FINANCE_OFFICER"
  | "ATTENDANCE_OFFICER"
  | "EXAM_MANAGER"
  | "RECEPTION_OFFICER"
  | "LIBRARIAN";

export type SystemRole = BuiltInRole | string;

export type PermissionAction =
  | "view"
  | "create"
  | "update"
  | "delete"
  | "import"
  | "export"
  | "print"
  | "approve";

export type PermissionModule =
  | "students"
  | "teachers"
  | "parents"
  | "attendance"
  | "fees"
  | "examinations"
  | "quiz"
  | "reports"
  | "finance"
  | "expenses"
  | "salaries"
  | "promotions"
  | "academics"
  | "settings"
  | "users"
  | "audit"
  | "sms"
  | "library";

export type PermissionMap = Record<
  PermissionModule,
  Record<PermissionAction, boolean>
>;

export interface RoleDefinition {
  id: string;
  name: string;
  label: string;
  description: string;
  builtIn: boolean;
  permissions: PermissionMap;
}

export interface SystemUser {
  id: string;
  userId: string;
  fullName: string;
  username: string;
  passwordHash: string;
  role: SystemRole;
  status: AccountStatus;
  lastLogin: string | null;
  createdAt: string;
  updatedAt: string;
  /** Linked entity when auto-provisioned. */
  linkedTeacherId?: string | null;
  linkedParentId?: string | null;
  linkedStudentId?: string | null;
  forcePasswordChange?: boolean;
  failedLoginAttempts?: number;
}

export interface UserSession {
  id: string;
  userId: string;
  loginAt: string;
  logoutAt: string | null;
  lastActivity: string;
  device: string;
  browser: string;
  ipAddress: string;
}

export interface UserNotification {
  id: string;
  type: string;
  message: string;
  at: string;
  read: boolean;
}

export interface UserAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  targetUser?: string;
  at: string;
  detail?: string;
  ipAddress?: string;
  device?: string;
  browser?: string;
}

export interface SecuritySettings {
  sessionTimeoutMinutes: number;
  maxFailedLogins: number;
  minPasswordLength: number;
  requireUppercase: boolean;
  requireNumber: boolean;
}

export interface UsersState {
  users: SystemUser[];
  roles: RoleDefinition[];
  sessions: UserSession[];
  notifications: UserNotification[];
  audit: UserAuditEntry[];
  security: SecuritySettings;
  userSeq: number;
}

export interface UsersDashboardSummary {
  totalUsers: number;
  activeUsers: number;
  inactiveUsers: number;
  administrators: number;
  teachers: number;
  parents: number;
  financeOfficers: number;
  attendanceOfficers: number;
  examManagers: number;
  receptionOfficers: number;
}

export interface UserRow {
  serial: number;
  id: string;
  userId: string;
  fullName: string;
  username: string;
  role: SystemRole;
  roleLabel: string;
  status: AccountStatus;
  lastLogin: string | null;
}

export interface CreateUserInput {
  fullName: string;
  username: string;
  password: string;
  role: SystemRole;
  status?: AccountStatus;
}

export interface UpdateUserInput {
  id: string;
  fullName?: string;
  username?: string;
  role?: SystemRole;
  status?: AccountStatus;
}
