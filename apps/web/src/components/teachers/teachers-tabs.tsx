"use client";

import { FileText, GraduationCap } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/layout/section-tabs";

/**
 * The Teachers section: the records, and the paperwork.
 *
 * Assignments and Shifts stay as buttons in the header — they are separate
 * jobs done to a teacher rather than another way of looking at one, and a tab
 * bar that holds everything reachable from a page is a second sidebar.
 */
const TABS: SectionTab[] = [
  { href: "/teachers", label: "teachers.teachers", icon: GraduationCap, exact: true },
  { href: "/teachers/documents", label: "nav.staffDocuments", icon: FileText },
];

export function TeachersTabs() {
  return <SectionTabs tabs={TABS} />;
}
