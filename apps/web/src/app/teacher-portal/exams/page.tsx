"use client";

import Link from "next/link";
import { ClipboardList, FileText, Info } from "lucide-react";

const SECTIONS = [
  {
    title: "Enter Marks",
    description:
      "Select year, class, section, exam, and subject to enter or import marks for official school examinations.",
    href: "/teacher-portal/exams/marks",
    icon: ClipboardList,
  },
  {
    title: "View Results",
    description: "Published results for your assigned classes and sections.",
    href: "/teacher-portal/results",
    icon: FileText,
  },
];

export default function TeacherPortalExamsPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Official Examinations</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Enter marks for school examinations assigned to you. Official exams are created by
          administrators — teachers do not create examinations here.
        </p>
      </div>

      <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50/80 p-4 text-sm text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-100">
        <Info className="mt-0.5 h-5 w-5 shrink-0" />
        <p>
          For teaching assessments, use{" "}
          <Link href="/teacher-portal/quizzes" className="font-medium underline">
            My Quizzes
          </Link>{" "}
          to create online quizzes for your assigned classes.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <span className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <s.icon className="h-6 w-6" />
            </span>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <span className="mt-4 text-sm font-medium text-primary group-hover:underline">
              Open →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
