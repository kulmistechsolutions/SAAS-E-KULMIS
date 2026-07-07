import type { PortalAnnouncement } from "./types";

const CATEGORY_LABEL: Record<PortalAnnouncement["category"], string> = {
  HOLIDAY: "Holiday Notice",
  EXAM: "Examination",
  MEETING: "Parent Meeting",
  EVENT: "School Event",
  FEE: "Fee Reminder",
  EMERGENCY: "Emergency",
  GENERAL: "General",
};

export function announcementCategoryLabel(
  category: PortalAnnouncement["category"],
): string {
  return CATEGORY_LABEL[category];
}

export function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function portalDevice(): string {
  if (typeof navigator === "undefined") return "Unknown";
  const ua = navigator.userAgent;
  if (/Mobile|Android|iPhone/i.test(ua)) return "Mobile";
  if (/Tablet|iPad/i.test(ua)) return "Tablet";
  return "Desktop";
}
