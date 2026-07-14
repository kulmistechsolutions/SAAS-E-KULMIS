"use client";

export interface TeacherPortalSession {
  teacherId: string;
  loginAt: string;
}

export interface TeacherPortalPermissions {
  canViewStudents: boolean;
  assignmentCount: number;
}

export interface TeacherPortalAnnouncement {
  id: string;
  title: string;
  body: string;
  audience: string;
  publishedAt: string;
}

export interface TeacherPortalNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

export interface TeacherPortalState {
  session: TeacherPortalSession | null;
  permissions: TeacherPortalPermissions | null;
}
