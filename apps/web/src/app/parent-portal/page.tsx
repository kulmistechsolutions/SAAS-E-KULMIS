"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Megaphone } from "lucide-react";
import { ParentDashboardCards } from "@/components/parents/summary-cards";
import { usePortal } from "@/components/parent-portal/portal-context";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import {
  announcementCategoryLabel,
  relativeTime,
} from "@/lib/parent-portal/format";
import {
  childExamResults,
  childFeeSummary,
  listAnnouncements,
  portalDashboardSummary,
} from "@/lib/parent-portal/store";
import { attendanceHistory } from "@/lib/students/history";
import { money } from "@/lib/students/format";
import { studentPublishedResults } from "@/lib/examinations/store";

export default function ParentPortalDashboardPage() {
  const { parent, children, selectedChild } = usePortal();

  const branding = useSchoolBranding();
  const summary = useMemo(() => portalDashboardSummary(parent.id), [parent.id]);
  const announcements = useMemo(() => listAnnouncements().slice(0, 3), []);

  const childAtt = selectedChild ? attendanceHistory(selectedChild, 30) : null;
  const childFees = selectedChild ? childFeeSummary(selectedChild) : null;
  const childResults = selectedChild ? childExamResults(selectedChild.id) : null;
  const latestResult = selectedChild
    ? studentPublishedResults(selectedChild.id).slice(-1)[0]
    : null;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border bg-gradient-to-r from-blue-500/10 via-indigo-500/5 to-transparent p-6">
        <p className="text-sm text-muted-foreground">{branding.name} · Parent Portal</p>
        <h1 className="mt-1 text-2xl font-bold">Welcome, {parent.name}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Monitor attendance, exams, fees, and school updates for your children.
        </p>
      </div>

      <ParentDashboardCards summary={summary} />

      {selectedChild && (
        <div className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Attendance — {selectedChild.fullName}</h2>
            {childAtt && (
              <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-lg bg-emerald-500/10 p-2">
                  <p className="text-xs text-muted-foreground">Present</p>
                  <p className="text-lg font-bold">{childAtt.present}</p>
                </div>
                <div className="rounded-lg bg-rose-500/10 p-2">
                  <p className="text-xs text-muted-foreground">Absent</p>
                  <p className="text-lg font-bold">{childAtt.absent}</p>
                </div>
                <div className="rounded-lg bg-amber-500/10 p-2">
                  <p className="text-xs text-muted-foreground">Late</p>
                  <p className="text-lg font-bold">{childAtt.late}</p>
                </div>
                <div className="rounded-lg bg-sky-500/10 p-2">
                  <p className="text-xs text-muted-foreground">Rate</p>
                  <p className="text-lg font-bold">{childAtt.percentage}%</p>
                </div>
              </div>
            )}
            <Link href="/parent-portal/attendance" className="mt-3 inline-block text-sm text-primary hover:underline">
              View full attendance →
            </Link>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Fee Summary</h2>
            {childFees && (
              <dl className="mt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Monthly fee</dt>
                  <dd className="font-medium">{money(childFees.monthlyFee)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Outstanding</dt>
                  <dd className="font-medium text-rose-600">{money(childFees.outstanding)}</dd>
                </div>
                <div className="flex justify-between">
                  <dt className="text-muted-foreground">Paid months</dt>
                  <dd className="font-medium">{childFees.paidMonths}</dd>
                </div>
              </dl>
            )}
            <Link href="/parent-portal/fees" className="mt-3 inline-block text-sm text-primary hover:underline">
              View fees →
            </Link>
          </div>

          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <h2 className="font-semibold">Latest Result</h2>
            {childResults?.blocked ? (
              <p className="mt-3 text-sm text-amber-600">
                Results are currently blocked for this student.
              </p>
            ) : latestResult ? (
              <div className="mt-3 text-sm">
                <p className="font-medium">{latestResult.examName}</p>
                <p className="text-muted-foreground">
                  Grade {latestResult.grade} · {latestResult.passed ? "Pass" : "Fail"}
                </p>
              </div>
            ) : (
              <p className="mt-3 text-sm text-muted-foreground">No published results yet.</p>
            )}
            <Link href="/parent-portal/exams" className="mt-3 inline-block text-sm text-primary hover:underline">
              View all results →
            </Link>
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">School Announcements</h2>
        </div>
        <ul className="mt-4 divide-y">
          {announcements.map((a) => (
            <li key={a.id} className="flex flex-wrap items-start justify-between gap-2 py-3 first:pt-0">
              <div>
                <p className="font-medium">{a.title}</p>
                <p className="text-sm text-muted-foreground line-clamp-1">{a.body}</p>
                <span className="mt-1 inline-block text-xs text-primary">
                  {announcementCategoryLabel(a.category)}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">{relativeTime(a.publishedAt)}</span>
            </li>
          ))}
        </ul>
        <Link href="/parent-portal/announcements" className="mt-2 inline-block text-sm text-primary hover:underline">
          All announcements →
        </Link>
      </div>

      {children.length > 1 && (
        <div className="rounded-xl border bg-card p-5">
          <h2 className="font-semibold">Your Children</h2>
          <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {children.map((c) => (
              <li key={c.id} className="rounded-lg border p-3 text-sm">
                <p className="font-medium">{c.fullName}</p>
                <p className="text-muted-foreground">
                  {c.className}{c.section ? ` — ${c.section}` : ""}
                </p>
                <p className="text-xs text-muted-foreground">{c.code}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
