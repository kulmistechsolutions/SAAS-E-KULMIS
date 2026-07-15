import type { PortalAnnouncement, PortalState } from "./types";

export function buildAnnouncements(): PortalAnnouncement[] {
  const now = Date.now();
  const daysAgo = (d: number) => new Date(now - d * 86400000).toISOString();
  return [
    {
      id: "ann_1",
      title: "Eid Al-Adha Holiday",
      body: "School will be closed from Thursday through Sunday. Classes resume Monday morning.",
      category: "HOLIDAY",
      publishedAt: daysAgo(2),
      pinned: true,
    },
    {
      id: "ann_2",
      title: "Mid-Term Examination Timetable",
      body: "The mid-term examination schedule has been published. Please ensure students arrive 15 minutes early.",
      category: "EXAM",
      publishedAt: daysAgo(5),
    },
    {
      id: "ann_3",
      title: "Parent-Teacher Meeting",
      body: "Quarterly parent-teacher meetings are scheduled for next Wednesday, 2:00 PM – 5:00 PM.",
      category: "MEETING",
      publishedAt: daysAgo(7),
    },
    {
      id: "ann_4",
      title: "Monthly Fee Reminder",
      body: "Please settle outstanding fees by the 10th of this month to avoid late penalties.",
      category: "FEE",
      publishedAt: daysAgo(3),
    },
    {
      id: "ann_5",
      title: "Science Fair 2025",
      body: "Students are invited to participate in the annual science fair. Registration closes Friday.",
      category: "EVENT",
      publishedAt: daysAgo(10),
    },
  ];
}

export function buildPortalSeed(): PortalState {
  return {
    session: null,
    selectedChildByParent: {},
    announcements: buildAnnouncements(),
    notifications: [],
    audit: [],
    parentProfile: null,
  };
}
