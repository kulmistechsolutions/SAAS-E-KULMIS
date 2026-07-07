"use client";

import Link from "next/link";
import {
  ClipboardList,
  FileText,
  Lock,
  PenLine,
  Users,
} from "lucide-react";
import type { MonitoringRow } from "@/lib/examinations/types";
import { SubmissionStatusBadge } from "./exam-status-badge";

export function MonitoringTable({ rows }: { rows: MonitoringRow[] }) {
  return (
    <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
      <div className="border-b px-5 py-4">
        <h2 className="font-semibold">Exam Monitoring</h2>
        <p className="text-sm text-muted-foreground">
          Teacher submission status by exam, class, section, and subject.
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-4 py-2.5 font-medium">Exam</th>
              <th className="px-4 py-2.5 font-medium">Class</th>
              <th className="px-4 py-2.5 font-medium">Section</th>
              <th className="px-4 py-2.5 font-medium">Subject</th>
              <th className="px-4 py-2.5 font-medium">Teacher</th>
              <th className="px-4 py-2.5 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={`${r.examId}-${r.subject}-${i}`} className="border-t">
                <td className="px-4 py-2.5 font-medium">{r.examName}</td>
                <td className="px-4 py-2.5">{r.className}</td>
                <td className="px-4 py-2.5">{r.section}</td>
                <td className="px-4 py-2.5">{r.subject}</td>
                <td className="px-4 py-2.5 text-muted-foreground">{r.teacherName}</td>
                <td className="px-4 py-2.5">
                  <SubmissionStatusBadge status={r.status} />
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  No teacher assessments to monitor.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

const ACTIONS = [
  { label: "Create Exam", href: "/examinations/create", icon: FileText, className: "bg-blue-500 hover:bg-blue-600 text-white" },
  { label: "Enter Marks", href: "/examinations/marks", icon: PenLine, className: "bg-emerald-500 hover:bg-emerald-600 text-white" },
  { label: "Exam Groups", href: "/examinations/groups", icon: Users, className: "bg-violet-500 hover:bg-violet-600 text-white" },
  { label: "Publish Results", href: "/examinations/results", icon: Lock, className: "bg-orange-500 hover:bg-orange-600 text-white" },
];

export function ExamQuickActions() {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <p className="text-sm font-semibold">Quick Actions</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <Link
            key={a.href}
            href={a.href}
            className={`flex flex-col items-center justify-center gap-2 rounded-xl px-3 py-4 text-center text-xs font-semibold shadow-sm transition-transform hover:scale-[1.02] ${a.className}`}
          >
            <a.icon className="h-5 w-5" />
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export function RecentExamsList({
  exams,
}: {
  exams: { id: string; name: string; className: string; section: string; status: string; term: string }[];
}) {
  return (
    <div className="rounded-2xl border bg-card shadow-sm">
      <div className="flex items-center gap-2 border-b px-5 py-4">
        <ClipboardList className="h-4 w-4 text-primary" />
        <h2 className="font-semibold">Recent Examinations</h2>
      </div>
      <div className="divide-y">
        {exams.map((e) => (
          <Link
            key={e.id}
            href={`/examinations/marks?exam=${e.id}`}
            className="flex items-center justify-between px-5 py-3 text-sm transition-colors hover:bg-secondary/40"
          >
            <div>
              <p className="font-medium">{e.name}</p>
              <p className="text-xs text-muted-foreground">
                {e.className} — {e.section} · {e.term}
              </p>
            </div>
            <span className="text-xs text-muted-foreground">{e.status.replace(/_/g, " ")}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
