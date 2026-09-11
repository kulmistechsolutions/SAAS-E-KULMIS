"use client";

import { FileText, UsersRound } from "lucide-react";
import { SectionTabs, type SectionTab } from "@/components/layout/section-tabs";

/** The two halves of the Students section: the records, and the paperwork. */
const TABS: SectionTab[] = [
  { href: "/students", label: "students.students", icon: UsersRound, exact: true },
  { href: "/students/documents", label: "nav.studentDocuments", icon: FileText },
];

export function StudentsTabs() {
  return <SectionTabs tabs={TABS} />;
}
