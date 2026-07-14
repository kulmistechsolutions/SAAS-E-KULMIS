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
}) => api<ApiAnnouncement>("/notifications/announcements", { method: "POST", body });

export async function fetchAnnouncements(): Promise<PortalAnnouncement[]> {
  const rows = await apiListAnnouncements();
  return rows.map(mapPortalAnnouncement);
}
