"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { ChevronRight, FileText } from "lucide-react";
import { REPORT_CATEGORIES } from "@/lib/reports/catalog";

const QUIZ_REPORTS = REPORT_CATEGORIES.find((c) => c.id === "quiz")?.reports ?? [];

export default function QuizReportsPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("quizReports.quizReports")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("quizReports.performanceAndActivityReportsViaReports")}</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {QUIZ_REPORTS.map((r) => (
          <Link key={r.slug} href={`/reports/quiz/${r.slug}`} className="group flex items-start gap-4 rounded-xl border bg-card p-5 shadow-sm hover:border-primary/30">
            <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div className="flex-1">
              <p className="font-semibold">{r.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{r.description}</p>
            </div>
            <ChevronRight className="h-5 w-5 opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
    </div>
  );
}
