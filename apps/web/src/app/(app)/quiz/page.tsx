"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, ClipboardList, FileText, GraduationCap, Library, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { QuizSummaryCards } from "@/components/quiz/summary-cards";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import { dashboardSummary, listQuizzes, useQuizState } from "@/lib/quiz/store";
import { shortDate } from "@/lib/quiz/format";

const QUICK = [
  { href: "/quiz/list", label: "All Quizzes", desc: "Search and manage quizzes", icon: ClipboardList },
  { href: "/quiz/create", label: "Create Quiz", desc: "Build a new assessment", icon: Plus },
  { href: "/quiz/question-bank", label: "Question Bank", desc: "Reusable questions", icon: Library },
  { href: "/quiz/portal", label: "Student Portal", desc: "Student quiz access", icon: GraduationCap },
  { href: "/quiz/reports", label: "Reports", desc: "Performance analytics", icon: FileText },
];

export default function QuizDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const state = useQuizState();
  const [teacherId, setTeacherId] = useState("");

  useEffect(() => setMounted(true), []);

  const summary = useMemo(
    () => (mounted ? dashboardSummary(teacherId || undefined) : null),
    [mounted, teacherId, state],
  );
  const recent = useMemo(
    () => (mounted ? listQuizzes({ teacherId: teacherId || undefined }).slice(0, 8) : []),
    [mounted, teacherId, state],
  );

  const teachers = useMemo(() => {
    const map = new Map<string, string>();
    for (const q of state.quizzes) map.set(q.teacherId, q.teacherName);
    return [...map.entries()];
  }, [state.quizzes]);

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading quiz module…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Online Quiz</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Create, publish, and evaluate digital assessments.
          </p>
        </div>
        <div className="flex gap-2">
          <Select value={teacherId} onChange={(e) => setTeacherId(e.target.value)} className="h-9 min-w-[180px]">
            <option value="">All teachers (Admin)</option>
            {teachers.map(([id, name]) => (
              <option key={id} value={id}>{name}</option>
            ))}
          </Select>
          <Link href="/quiz/create">
            <Button className="h-9"><Plus className="mr-2 h-4 w-4" />Create Quiz</Button>
          </Link>
        </div>
      </div>

      {summary && <QuizSummaryCards summary={summary} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {QUICK.map((q) => (
          <Link key={q.href} href={q.href} className="group rounded-xl border bg-card p-4 shadow-sm hover:border-primary/30 hover:shadow-md">
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <q.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="mt-3 font-semibold">{q.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="font-semibold">Recent Quizzes</h2>
          <Link href="/quiz/list" className="text-xs font-medium text-primary hover:underline">View all</Link>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2 font-medium">Quiz</th>
              <th className="px-4 py-2 font-medium">Class</th>
              <th className="px-4 py-2 font-medium">Status</th>
              <th className="px-4 py-2 font-medium">Attempts</th>
            </tr>
          </thead>
          <tbody>
            {recent.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5">
                  <Link href={`/quiz/${r.id}`} className="font-medium text-primary">{r.title}</Link>
                  <p className="text-xs text-muted-foreground">{r.code}</p>
                </td>
                <td className="px-4 py-2.5">{r.className} — {r.section}</td>
                <td className="px-4 py-2.5"><QuizStatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5 tabular-nums">{r.attemptCount}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
