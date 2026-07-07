export type PortalNotificationType =
  | "ATTENDANCE_ALERT"
  | "ABSENCE"
  | "EXAM_PUBLISHED"
  | "RESULT_PUBLISHED"
  | "QUIZ_ASSIGNED"
  | "QUIZ_RESULT"
  | "FEE_DUE"
  | "FEE_RECEIVED"
  | "ANNOUNCEMENT";

export type PortalAuditAction =
  | "LOGIN"
  | "LOGOUT"
  | "PROFILE_VIEWED"
  | "STUDENT_VIEWED"
  | "ATTENDANCE_VIEWED"
  | "RESULT_VIEWED"
  | "FEE_VIEWED"
  | "RECEIPT_DOWNLOADED"
  | "PASSWORD_CHANGED";

export interface PortalSession {
  parentId: string;
  loginAt: string;
}

export interface PortalAnnouncement {
  id: string;
  title: string;
  body: string;
  category: "HOLIDAY" | "EXAM" | "MEETING" | "EVENT" | "FEE" | "EMERGENCY" | "GENERAL";
  publishedAt: string;
  pinned?: boolean;
}

export interface PortalNotification {
  id: string;
  parentId: string;
  studentId: string | null;
  type: PortalNotificationType;
  title: string;
  message: string;
  createdAt: string;
  read: boolean;
}

export interface PortalAuditEntry {
  id: string;
  parentId: string;
  studentId: string | null;
  action: PortalAuditAction;
  detail?: string;
  at: string;
  ip: string;
  device: string;
}

export interface PortalState {
  session: PortalSession | null;
  selectedChildByParent: Record<string, string>;
  announcements: PortalAnnouncement[];
  notifications: PortalNotification[];
  audit: PortalAuditEntry[];
}
