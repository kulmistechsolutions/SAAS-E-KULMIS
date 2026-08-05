"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  BarChart3,
  CheckCircle2,
  FileText,
  Layers,
  Loader2,
  TrendingUp,
  Users,
  XCircle,
} from "lucide-react";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  apiExamReportsOverview,
  type ApiExamReportsOverview,
} from "@/lib/examinations/api";
import {
  ensureAcademicsLoaded,
  getAcademicsState,
} from "@/lib/academics/store";
import { toast } from "@/lib/toast";

/** Every tile leads to a page that can actually produce the report. */
const REPORTS: { title: string; hint: string; href: string; icon: typeof Users }[] = [
  {
    title: "Class Result Sheets",
    hint: "Full class results — single exam or All Terms (Combined), with PDF/Excel export.",
    href: "/examinations/results",
    icon: Users,
  },
  {
    title: "Student Result Cards",
    hint: "One student's branded result card, printable with QR verification.",
    href: "/examinations/results",
    icon: FileText,
  },
  {
    title: "Combined Term Reports",
    hint: "Weighted results across every exam in a group.",
    href: "/examinations/groups",
    icon: Layers,
  },
  {
    title: "Teacher Submission Report",
    hint: "Which teachers have entered marks, by exam and subject.",
    href: "/examinations/monitoring",
    icon: BarChart3,
  },
];

function Stat({
  label,
  value,
  tone,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "danger" | "info";
  icon?: typeof Users;
}) {
  const toneCls =
    tone === "success"
      ? "text-emerald-600 dark:text-emerald-400"
      : tone === "danger"
        ? "text-rose-600 dark:text-rose-400"
        : tone === "info"
          ? "text-primary"
          : "text-foreground";
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </div>
      <p className={`mt-1.5 text-2xl font-bold tabular-nums ${toneCls}`}>{value}</p>
    </div>
  );
}

export default function ExamReportsPage() {
  const t = useT();
  const [years, setYears] = useState<{ id: string; name: string }[]>([]);
  const [yearId, setYearId] = useState("");
  const [data, setData] = useState<ApiExamReportsOverview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void ensureAcademicsLoaded().then(() => {
      const ys = getAcademicsState().academicYears;
      setYears(ys.map((y) => ({ id: y.id, name: y.name })));
    });
  }, []);

  const load = useCallback(() => {
    setLoading(true);
    void apiExamReportsOverview(yearId || undefined)
      .then(setData)
      .catch(() => {
        setData(null);
        toast("Could not load report data", "error");
      })
      .finally(() => setLoading(false));
  }, [yearId]);

  useEffect(() => {
    load();
  }, [load]);

  const maxGrade = useMemo(
    () => Math.max(1, ...(data?.gradeDistribution ?? []).map((g) => g.count)),
    [data],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("examinationsReports.examReports")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("examinationsReports.viewSearchFilterPrintAndExport")}
          </p>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("examinationsReports.academicYear")}
          </label>
          <Select
            className="h-9 w-auto min-w-[11rem]"
            value={yearId}
            onChange={(e) => setYearId(e.target.value)}
          >
            <option value="">{t("examinationsReports.allYears")}</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 py-10 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("examinationsReports.loading")}
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label={t("examinationsReports.totalExams")} value={data.totalExams} icon={FileText} />
            <Stat
              label={t("examinationsReports.publishedExams")}
              value={data.publishedExams}
              tone="info"
              icon={CheckCircle2}
            />
            <Stat label={t("examinationsReports.draftExams")} value={data.draftExams} icon={FileText} />
            <Stat label={t("examinationsReports.examGroups")} value={data.examGroups} icon={Layers} />
            <Stat
              label={t("examinationsReports.studentsPassed")}
              value={data.studentsPassed}
              tone="success"
              icon={CheckCircle2}
            />
            <Stat
              label={t("examinationsReports.studentsFailed")}
              value={data.studentsFailed}
              tone="danger"
              icon={XCircle}
            />
            <Stat
              label={t("examinationsReports.passRate")}
              value={`${data.passRate}%`}
              tone="info"
              icon={TrendingUp}
            />
            <Stat
              label={t("examinationsReports.averagePerformance")}
              value={`${data.averagePercent}%`}
              tone="info"
              icon={BarChart3}
            />
          </div>

          {data.gradedStudents === 0 ? (
            <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
              {t("examinationsReports.noPublishedResultsYet")}
            </div>
          ) : (
            <div className="grid items-start gap-6 lg:grid-cols-2">
              {/* Grade distribution */}
              <div className="rounded-2xl border bg-card p-5 shadow-sm">
                <h2 className="font-semibold">{t("examinationsReports.gradeDistribution")}</h2>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {data.gradedStudents} {t("examinationsReports.studentsGraded")}
                </p>
                <div className="mt-4 space-y-2">
                  {data.gradeDistribution.map((g) => (
                    <div key={g.grade} className="flex items-center gap-3">
                      <span className="w-8 shrink-0 text-sm font-bold tabular-nums">
                        {g.grade}
                      </span>
                      <div className="h-2.5 flex-1 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${(g.count / maxGrade) * 100}%` }}
                        />
                      </div>
                      <span className="w-10 shrink-0 text-end text-sm tabular-nums text-muted-foreground">
                        {g.count}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-class performance */}
              <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-5 py-4">
                  <h2 className="font-semibold">{t("examinationsReports.performanceByClass")}</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[420px] text-sm">
                    <thead className="bg-secondary/60 text-start text-xs text-muted-foreground">
                      <tr>
                        <th className="px-4 py-2.5 font-medium">{t("examinationsReports.class")}</th>
                        <th className="px-4 py-2.5 text-end font-medium">{t("examinationsReports.students")}</th>
                        <th className="px-4 py-2.5 text-end font-medium">{t("examinationsReports.average")}</th>
                        <th className="px-4 py-2.5 text-end font-medium">{t("examinationsReports.passRate")}</th>
                        <th className="px-4 py-2.5 text-end font-medium">{t("examinationsReports.report")}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.byClass.map((c) => (
                        <tr key={c.classId} className="border-t">
                          <td className="px-4 py-2.5 font-medium">{c.className}</td>
                          <td className="px-4 py-2.5 text-end tabular-nums">{c.gradedStudents}</td>
                          <td className="px-4 py-2.5 text-end tabular-nums">{c.averagePercent}%</td>
                          <td className="px-4 py-2.5 text-end">
                            <Badge tone={c.passRate >= 50 ? "success" : "danger"}>
                              {c.passRate}%
                            </Badge>
                          </td>
                          <td className="px-4 py-2.5 text-end">
                            <Link
                              href={`/examinations/results/${c.classId}`}
                              className="text-xs text-primary hover:underline"
                            >
                              {t("examinationsReports.open")}
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      <div>
        <h2 className="mb-3 font-semibold">{t("examinationsReports.reportPages")}</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {REPORTS.map((r) => (
            <Link
              key={r.title}
              href={r.href}
              className="flex flex-col gap-2 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <r.icon className="h-5 w-5" />
              </span>
              <span className="font-medium">{r.title}</span>
              <span className="text-xs text-muted-foreground">{r.hint}</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
