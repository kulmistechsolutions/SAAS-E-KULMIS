"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { ExamSummaryCards } from "@/components/examinations/summary-cards";
import {
  ExamQuickActions,
  MonitoringTable,
  RecentExamsList,
} from "@/components/examinations/widgets";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { examTypeLabel, shortDate } from "@/lib/examinations/format";
import {
  assignExamGroup,
  dashboardSummary,
  monitoringRows,
  recentExams,
  useExaminationsState,
} from "@/lib/examinations/store";
import type { ExamStatus } from "@/lib/examinations/types";
import { toast } from "@/lib/toast";

export default function ExaminationsDashboardPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const exams = useExaminationsState();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "">("");

  useEffect(() => setMounted(true), []);

  const summary = useMemo(
    () => (mounted ? dashboardSummary() : null),
    [mounted, exams],
  );
  const monitoring = useMemo(
    () => (mounted ? monitoringRows() : []),
    [mounted, exams],
  );
  const recent = useMemo(
    () => (mounted ? recentExams(6) : []),
    [mounted, exams],
  );

  const classOptions = useMemo(
    () => [...new Set(exams.exams.map((e) => e.className))].sort(),
    [exams.exams],
  );

  // Every exam is visible by default — search/class/status just narrow the
  // same table down, so admins manage the whole exam list from one place
  // instead of navigating away to find a specific exam first.
  const visibleExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.exams.filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q) || e.term.toLowerCase().includes(q)) &&
        (!classFilter || e.className === classFilter) &&
        (!statusFilter || e.status === statusFilter),
    );
  }, [exams.exams, search, classFilter, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("examinations.examinationManagement")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("examinations.completeExaminationLifecycleCreationMarkingResults")}
          </p>
        </div>
        <Link
          href="/examinations/create"
          className="inline-flex h-10 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Plus className="me-2 h-4 w-4" />
          {t("examinations.createExam")}
        </Link>
      </div>

      {summary && <ExamSummaryCards summary={summary} />}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          {mounted && <MonitoringTable rows={monitoring.slice(0, 12)} />}
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="font-semibold">{t("examinations.allExaminations")}</h2>
                <p className="text-xs text-muted-foreground">
                  {visibleExams.length} / {exams.exams.length} {t("examinations.examS")}
                </p>
              </div>
              <Link href="/examinations/monitoring" className="text-sm text-primary hover:underline">
                {t("examinations.viewMonitoring")}
              </Link>
            </div>
            <div className="flex flex-wrap gap-2 border-b px-5 py-3">
              <Input
                className="h-8 min-w-[10rem] flex-1 text-xs"
                placeholder={t("examinations.searchExamOrTerm")}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
              <Select
                className="h-8 w-auto min-w-[8rem] text-xs"
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
              >
                <option value="">{t("examinations.allClasses")}</option>
                {classOptions.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
              <Select
                className="h-8 w-auto min-w-[8rem] text-xs"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as ExamStatus | "")}
              >
                <option value="">{t("examinations.allStatuses")}</option>
                {(["DRAFT", "OPEN", "IN_PROGRESS", "COMPLETED", "LOCKED", "PUBLISHED", "ARCHIVED"] as const).map(
                  (s) => (
                    <option key={s} value={s}>{s}</option>
                  ),
                )}
              </Select>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-sm">
                <thead className="sticky top-0 bg-secondary/90 text-start text-xs text-muted-foreground backdrop-blur">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.exam")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.classSection")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.term")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.type")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.weight")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.period")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.status")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.group")}</th>
                    <th className="px-4 py-2.5 font-medium">{t("examinations.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleExams.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="px-4 py-2.5">
                        <Link href={`/examinations/marks?exam=${e.id}`} className="font-medium text-primary hover:underline">
                          {e.name}
                        </Link>
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {e.className} — {e.section}
                      </td>
                      <td className="px-4 py-2.5">{e.term}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{examTypeLabel(e.examType)}</td>
                      <td className="px-4 py-2.5 tabular-nums">{e.weightPercent}%</td>
                      <td className="px-4 py-2.5 text-muted-foreground text-xs">
                        {shortDate(e.startDate)} — {shortDate(e.endDate)}
                      </td>
                      <td className="px-4 py-2.5">
                        <ExamStatusBadge status={e.status} />
                      </td>
                      <td className="px-4 py-2.5">
                        <Select
                          className="h-8 min-w-[9rem] text-xs"
                          value={e.examGroupId ?? ""}
                          onChange={async (ev) => {
                            const res = await assignExamGroup(e.id, ev.target.value || null);
                            if (!res.ok) toast(res.error ?? "Failed to assign exam group", "error");
                            else toast("Exam group updated", "success");
                          }}
                        >
                          <option value="">{t("examinations.none")}</option>
                          {exams.examGroups.map((g) => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                          ))}
                        </Select>
                      </td>
                      <td className="whitespace-nowrap px-4 py-2.5 text-xs">
                        <Link
                          href={`/examinations/results/${e.classId}?exam=${e.id}`}
                          className="text-primary hover:underline"
                        >
                          {t("examinations.results")}
                        </Link>
                      </td>
                    </tr>
                  ))}
                  {visibleExams.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-10 text-center text-muted-foreground">
                        {t("examinations.noExaminationsMatchTheseFilters")}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div className="space-y-6">
          {mounted && <RecentExamsList exams={recent} />}
          <ExamQuickActions />
        </div>
      </div>
    </div>
  );
}
