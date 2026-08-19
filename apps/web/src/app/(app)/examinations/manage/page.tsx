"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { AlertTriangle, Loader2, LockOpen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { ExamStatusBadge } from "@/components/examinations/exam-status-badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { deleteExam, updateExamStatus, useExaminationsState } from "@/lib/examinations/store";
import { examTypeLabel, shortDate } from "@/lib/examinations/format";
import type { Exam } from "@/lib/examinations/types";
import { toast } from "@/lib/toast";

export default function ExaminationsManagePage() {
  const t = useT();
  const { exams } = useExaminationsState();

  const [yearFilter, setYearFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [deleting, setDeleting] = useState<Exam | null>(null);
  const [rowBusy, setRowBusy] = useState<string | null>(null);
  const [bulkTyped, setBulkTyped] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);

  const years = useMemo(
    () => [...new Set(exams.map((e) => e.academicYear))].sort((a, b) => b.localeCompare(a)),
    [exams],
  );
  const classes = useMemo(() => {
    const scoped = yearFilter ? exams.filter((e) => e.academicYear === yearFilter) : exams;
    return [...new Set(scoped.map((e) => e.className))].sort();
  }, [exams, yearFilter]);

  const filtered = useMemo(
    () =>
      exams.filter(
        (e) =>
          (!yearFilter || e.academicYear === yearFilter) &&
          (!classFilter || e.className === classFilter),
      ),
    [exams, yearFilter, classFilter],
  );

  async function handleOpen(exam: Exam) {
    setRowBusy(exam.id);
    const res = await updateExamStatus(exam.id, "OPEN");
    setRowBusy(null);
    if (!res.ok) toast(res.error ?? "Failed to open exam", "error");
    else toast("Exam opened — now visible in Results & Monitoring", "success");
  }

  async function handleDeleteOne() {
    if (!deleting) return;
    setRowBusy(deleting.id);
    const res = await deleteExam(deleting.id);
    setRowBusy(null);
    setDeleting(null);
    if (!res.ok) toast(res.error ?? "Failed to delete exam", "error");
    else toast("Exam deleted", "success");
  }

  const bulkConfirmed = bulkTyped.trim().toUpperCase() === "DELETE";
  const bulkScopeLabel =
    yearFilter || classFilter
      ? [yearFilter, classFilter].filter(Boolean).join(" · ")
      : t("examinationsManage.allExams");

  async function handleBulkDelete() {
    if (!bulkConfirmed || filtered.length === 0) return;
    setBulkBusy(true);
    let deleted = 0;
    let failed = 0;
    for (const exam of filtered) {
      const res = await deleteExam(exam.id, true);
      if (res.ok) deleted++;
      else failed++;
    }
    setBulkBusy(false);
    setBulkTyped("");
    if (failed > 0) {
      toast(`${deleted} deleted, ${failed} failed`, deleted > 0 ? "success" : "error");
    } else {
      toast(`${deleted} exam(s) deleted`, "success");
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("examinationsManage.examManagement")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("examinationsManage.browseFilterAndRemoveExaminationsStudent")}
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select className="w-auto min-w-[10rem]" value={yearFilter} onChange={(e) => { setYearFilter(e.target.value); setClassFilter(""); }}>
          <option value="">{t("examinationsManage.allAcademicYears")}</option>
          {years.map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </Select>
        <Select className="w-auto min-w-[10rem]" value={classFilter} onChange={(e) => setClassFilter(e.target.value)}>
          <option value="">{t("examinationsManage.allClasses")}</option>
          {classes.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary/60 text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.exam")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.academicYear")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.classSection")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.term")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.type")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.period")}</th>
                <th className="px-4 py-2.5 font-medium">{t("examinationsManage.status")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("examinationsManage.delete")}</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id} className="border-t">
                  <td className="px-4 py-2.5 font-medium">{e.name}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.academicYear}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{e.className} — {e.section}</td>
                  <td className="px-4 py-2.5">{e.term}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{examTypeLabel(e.examType)}</td>
                  <td className="px-4 py-2.5 text-xs text-muted-foreground">
                    {shortDate(e.startDate)} — {shortDate(e.endDate)}
                  </td>
                  <td className="px-4 py-2.5">
                    <ExamStatusBadge status={e.status} />
                  </td>
                  <td className="px-4 py-2.5 text-end">
                    <div className="inline-flex items-center gap-2">
                      {e.status === "DRAFT" && (
                        <button
                          type="button"
                          onClick={() => void handleOpen(e)}
                          disabled={rowBusy === e.id}
                          title={t("examinationsManage.openExamHint")}
                          className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-emerald-600 hover:bg-emerald-50 disabled:opacity-50 dark:text-emerald-400 dark:hover:bg-emerald-950/30"
                        >
                          {rowBusy === e.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <LockOpen className="h-3.5 w-3.5" />
                          )}
                          {t("examinationsManage.open")}
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setDeleting(e)}
                        disabled={rowBusy === e.id}
                        className="inline-flex items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:text-rose-400 dark:hover:bg-rose-950/30"
                      >
                        {rowBusy === e.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                        {t("examinationsManage.delete")}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                    {t("examinationsManage.noExaminationsMatchTheseFilters")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-red-300 bg-red-50/50 p-5 dark:border-red-900/50 dark:bg-red-950/20">
        <h2 className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300">
          <AlertTriangle className="h-4 w-4" />
          {t("examinationsManage.dangerZone")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("examinationsManage.deletesEveryExaminationMatchingTheFilters")}{" "}
          <strong>{bulkScopeLabel}</strong> ({filtered.length} {t("examinationsManage.examS")}),{" "}
          <strong>{t("examinationsManage.includingPublishedLockedAndMarked")}</strong>.{" "}
          {t("examinationsManage.studentAndParentRecordsAreNeverDeleted")}
        </p>

        <div className="mt-4 max-w-md space-y-3">
          <div>
            <label className="mb-1 block text-sm font-medium">
              {t("examinationsManage.type")} <span className="font-mono">DELETE</span> {t("examinationsManage.toConfirm")}
            </label>
            <Input
              value={bulkTyped}
              onChange={(e) => setBulkTyped(e.target.value)}
              placeholder="DELETE"
              autoComplete="off"
              disabled={bulkBusy}
            />
          </div>
          <Button
            variant="destructive"
            disabled={!bulkConfirmed || filtered.length === 0 || bulkBusy}
            onClick={() => void handleBulkDelete()}
          >
            {bulkBusy ? (
              <>
                <Loader2 className="me-2 h-4 w-4 animate-spin" /> {t("examinationsManage.deleting")}
              </>
            ) : (
              `${t("examinationsManage.delete")} ${filtered.length} ${t("examinationsManage.examS")}`
            )}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={!!deleting}
        title={t("examinationsManage.deleteExam")}
        message={
          deleting
            ? `Delete "${deleting.name}" (${deleting.className} — ${deleting.section})? This cannot be undone. Published/locked exams or exams with submitted marks cannot be deleted — archive them instead.`
            : ""
        }
        onConfirm={handleDeleteOne}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
