"use client";

import { api } from "@/lib/api";
import type { PortalAnnouncement } from "@/lib/parent-portal/types";
import { mapPortalAnnouncement, type ApiAnnouncement } from "@/lib/parent-portal/api";

export const apiListAnnouncements = () =>
  api<ApiAnnouncement[]>("/notifications/announcements");

export const apiCreateAnnouncement = (body: {
  title: string;
  body: string;
  audience?: string;
  pinned?: boolean;
  notifyAudience?: "ALL" | "PARENTS" | "TEACHERS";
}) => api<ApiAnnouncement>("/notifications/announcements", { method: "POST", body });

export async function fetchAnnouncements(): Promise<PortalAnnouncement[]> {
  const rows = await apiListAnnouncements();
  return rows.map(mapPortalAnnouncement);
}

export interface ApiUserNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  readAt: string | null;
  createdAt: string;
}

/** The current staff user's own notifications — admin/teacher/etc, matched
 *  server-side by the logged-in user's id (see NotificationsService.list). */
export const apiListMyNotifications = () =>
  api<ApiUserNotification[]>("/notifications");

export const apiMarkNotificationRead = (id: string) =>
  api<ApiUserNotification>(`/notifications/${id}/read`, { method: "PATCH" });
