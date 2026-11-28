"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileText, GraduationCap, Plus, Search } from "lucide-react";
import { ExamSummaryCards } from "@/components/examinations/summary-cards";
import {
  ExamNavBar,
  MonitoringTable,
  RecentExamsList,
} from "@/components/examinations/widgets";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import { ExportMenu } from "@/components/export/export-menu";
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
import { useHydrated } from "@/lib/use-hydrated";

export default function ExaminationsDashboardPage() {
  const t = useT();
  const mounted = useHydrated();
  const exams = useExaminationsState();
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<ExamStatus | "">("");
  const [typeFilter, setTypeFilter] = useState("");

  const summary = useMemo(() => (mounted ? dashboardSummary() : null), [mounted, exams]);
  const monitoring = useMemo(() => (mounted ? monitoringRows() : []), [mounted, exams]);
  const recent = useMemo(() => (mounted ? recentExams(6) : []), [mounted, exams]);

  const classOptions = useMemo(
    () => [...new Set(exams.exams.map((e) => e.className))].sort(),
    [exams.exams],
  );
  const typeOptions = useMemo(
    () => [...new Set(exams.exams.map((e) => e.examType))].sort(),
    [exams.exams],
  );

  // Every exam is visible by default — search/class/status/type just narrow
  // the same table, so admins manage the whole exam list from one place.
  const visibleExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.exams.filter(
      (e) =>
        (!q || e.name.toLowerCase().includes(q) || e.term.toLowerCase().includes(q)) &&
        (!classFilter || e.className === classFilter) &&
        (!statusFilter || e.status === statusFilter) &&
        (!typeFilter || e.examType === typeFilter),
    );
  }, [exams.exams, search, classFilter, statusFilter, typeFilter]);

  return (
    <div className="relative space-y-6">
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-80 rounded-b-[3rem] bg-gradient-to-br from-violet-200/50 via-indigo-100/30 to-transparent dark:from-violet-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />

      {/* ── Header ── */}
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <GraduationCap className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {t("examinations.examinationManagement")}
            </h1>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("examinations.completeExaminationLifecycleCreationMarkingResults")}
            </p>
          </div>
        </div>
        <Link
          href="/examinations/create"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm shadow-primary/30 transition-colors hover:bg-primary/90"
        >
          <Plus className="me-2 h-4 w-4" />
          {t("examinations.createExam")}
        </Link>
      </div>

      {/* ── Module navigation ── */}
      <div className="relative">
        <ExamNavBar />
      </div>

      {/* ── Counts ── */}
      <div className="relative">{summary && <ExamSummaryCards summary={summary} />}</div>

      {/* ── Monitoring and recent ── */}
      <div className="relative grid items-start gap-6 xl:grid-cols-3">
        <div className="xl:col-span-2">{mounted && <MonitoringTable rows={monitoring.slice(0, 10)} />}</div>
        <div>{mounted && <RecentExamsList exams={recent} />}</div>
      </div>

      {/* ── All examinations ── */}
      <div className="relative overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <h2 className="font-semibold">{t("examinations.allExaminations")}</h2>
              <p className="text-xs text-muted-foreground">
                {visibleExams.length} / {exams.exams.length} {t("examinations.examS")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <ExportMenu
              className="[&>button]:h-9"
              disabled={visibleExams.length === 0}
              spec={() => ({
                title: "Examinations",
                fileName: "examinations",
                subtitle: [`${visibleExams.length} exam(s)`],
                columns: [
                  { key: "name", label: "Exam" },
                  { key: "cls", label: "Class / Section" },
                  { key: "term", label: "Term" },
                  { key: "type", label: "Type" },
                  { key: "weight", label: "Weight %", align: "right" },
                  { key: "period", label: "Period" },
                  { key: "status", label: "Status" },
                ],
                rows: visibleExams.map((e) => ({
                  name: e.name,
                  cls: `${e.className} — ${e.section}`,
                  term: e.term,
                  type: examTypeLabel(e.examType),
                  weight: e.weightPercent,
                  period: `${shortDate(e.startDate)} — ${shortDate(e.endDate)}`,
                  status: e.status,
                })),
              })}
            />
            <Link
              href="/examinations/monitoring"
              className="hidden items-center gap-1 text-sm font-medium text-primary hover:underline sm:inline-flex"
            >
              {t("examinations.viewMonitoring")} <ArrowRight className="h-4 w-4 rtl:rotate-180" />
            </Link>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 border-b px-5 py-3">
          <div className="relative min-w-[12rem] flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="h-9 ps-9 text-sm"
              placeholder={t("examinations.searchExamOrTerm")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select className="h-9 w-auto min-w-[9rem] text-sm" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
            <option value="">{t("examinations.allClasses")}</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          <Select
            className="h-9 w-auto min-w-[9rem] text-sm"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as ExamStatus | "")}
          >
            <option value="">{t("examinations.allStatuses")}</option>
            {(["DRAFT", "OPEN", "IN_PROGRESS", "COMPLETED", "LOCKED", "PUBLISHED", "ARCHIVED"] as const).map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
          <Select className="h-9 w-auto min-w-[9rem] text-sm" value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}>
            <option value="">All Types</option>
            {typeOptions.map((ty) => (
              <option key={ty} value={ty}>{examTypeLabel(ty)}</option>
            ))}
          </Select>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] text-sm">
            <thead className="bg-muted/50 text-xs font-semibold text-foreground/80">
              <tr>
                <th className="px-4 py-2.5 text-start">{t("examinations.exam")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.classSection")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.term")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.type")}</th>
                <th className="px-4 py-2.5 text-end">{t("examinations.weight")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.period")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.status")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.group")}</th>
                <th className="px-4 py-2.5 text-start">{t("examinations.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {visibleExams.map((e) => (
                <tr key={e.id} className="border-t transition-colors hover:bg-muted/30">
                  <td className="px-4 py-2.5">
                    <Link href={`/examinations/marks?exam=${e.id}`} className="font-semibold text-primary hover:underline">
                      {e.name}
                    </Link>
                  </td>
                  <td className="px-4 py-2.5">
                    {e.className}
                    {e.section && e.section !== "—" ? <span className="text-muted-foreground"> — {e.section}</span> : null}
                  </td>
                  <td className="px-4 py-2.5">{e.term}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{examTypeLabel(e.examType)}</td>
                  <td className="px-4 py-2.5 text-end font-medium tabular-nums">{e.weightPercent}%</td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-xs text-muted-foreground">
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
                      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-2.5 py-1.5 font-semibold text-primary transition hover:bg-primary/15"
                    >
                      <FileText className="h-3.5 w-3.5" />
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
  );
}
