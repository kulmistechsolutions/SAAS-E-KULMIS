"use client";


import { useT } from "@/lib/i18n/provider";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Eye } from "lucide-react";
import { useParams, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { SubmissionStatusBadge } from "@/components/examinations/exam-status-badge";
import {
  apiMonitoringClassDetail,
  apiSendExamReminder,
  type ApiMonitoringClassDetail,
} from "@/lib/examinations/api";
import { getAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";

function formatSubmittedDate(iso: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  return d.toLocaleDateString();
}

export default function ClassMonitoringPage() {
  const t = useT();
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          {t("examinationsMonitoring.loadingMonitoring")}
        </div>
      }
    >
      <ClassMonitoringContent />
    </Suspense>
  );
}

function ClassMonitoringContent() {
  const t = useT();
  const params = useParams();
  const searchParams = useSearchParams();
  const classId = params.classId as string;
  const examId = searchParams.get("examId") ?? "";
  const yearName = searchParams.get("year") ?? "";

  const yearId = useMemo(() => {
    if (!yearName) return undefined;
    return getAcademicsState().academicYears.find((y) => y.name === yearName)?.id;
  }, [yearName]);

  const [sectionId, setSectionId] = useState("");
  const [data, setData] = useState<ApiMonitoringClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [reminding, setReminding] = useState<string | null>(null);
  const [sendSms, setSendSms] = useState(false);
  const [sendEmail, setSendEmail] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    void apiMonitoringClassDetail(classId, {
      academicYearId: yearId,
      examId: examId || undefined,
      sectionId: sectionId || undefined,
    })
      .then(setData)
      .catch(() => {
        setData(null);
        toast("Could not load class monitoring", "error");
      })
      .finally(() => setLoading(false));
  }, [classId, yearId, examId, sectionId]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleReminder(examId: string, subjectId: string, key: string) {
    setReminding(key);
    try {
      const res = await apiSendExamReminder({
        examId,
        subjectId,
        sms: sendSms,
        email: sendEmail,
      });
      const parts = ["In-app"];
      if (res.channels.sms) parts.push("SMS");
      if (res.channels.email) parts.push("Email");
      toast(`Reminder sent (${parts.join(", ")})`, "success");
    } catch (err) {
      toast(err instanceof Error ? err.message : "Could not send reminder", "error");
    } finally {
      setReminding(null);
    }
  }

  const className = data?.subjects[0]?.className ?? "Class";

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start gap-4">
        <Button asChild variant="ghost" className="h-9 px-2">
          <Link href="/examinations/monitoring">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t("examinationsMonitoring.back")}
          </Link>
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{className} {t("examinationsMonitoring.monitoring")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("examinationsMonitoring.subjectLevelSubmissionTrackingFilterBy")}
          </p>
        </div>
      </div>

      {data && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <SummaryCard label={t("examinationsMonitoring.totalSubjects")} value={data.summary.totalSubjects} />
          <SummaryCard label={t("examinationsMonitoring.submitted")} value={data.summary.submittedSubjects} tone="success" />
          <SummaryCard label={t("examinationsMonitoring.pending")} value={data.summary.pendingSubjects} tone="warning" />
          <SummaryCard
            label={t("examinationsMonitoring.progress")}
            value={`${data.summary.completionPercent}%`}
            tone="info"
          />
        </div>
      )}

      {data && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border bg-card p-4">
          {data.sections.length > 0 && (
            <>
              <label className="text-xs font-medium text-muted-foreground">{t("examinationsMonitoring.section")}</label>
              <Select
                value={sectionId}
                onChange={(e) => setSectionId(e.target.value)}
                className="max-w-xs"
              >
                <option value="">{t("examinationsMonitoring.allSections")}</option>
                {data.sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {t("examinationsMonitoring.section")} {s.name}
                  </option>
                ))}
              </Select>
            </>
          )}
          <div className={`flex flex-wrap items-center gap-4 text-sm ${data.sections.length > 0 ? "ml-auto" : ""}`}>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendSms}
                onChange={(e) => setSendSms(e.target.checked)}
              />
              {t("examinationsMonitoring.alsoSendSms")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={sendEmail}
                onChange={(e) => setSendEmail(e.target.checked)}
              />
              {t("examinationsMonitoring.alsoNotifyByEmail")}
            </label>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center rounded-2xl border bg-card py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[960px] text-sm">
              <thead className="sticky top-0 bg-secondary/90 text-left text-xs text-muted-foreground backdrop-blur">
                <tr>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.subject")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.assignedTeacher")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.class")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.section")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.exam")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.submissionStatus")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.submittedDate")}</th>
                  <th className="px-4 py-2.5 font-medium">{t("examinationsMonitoring.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {data?.subjects.map((s) => {
                  const key = `${s.examId}-${s.subjectId}`;
                  return (
                    <tr key={key} className="border-t">
                      <td className="px-4 py-2.5 font-medium">{s.subject}</td>
                      <td className="px-4 py-2.5">{s.teacherName}</td>
                      <td className="px-4 py-2.5">{s.className}</td>
                      <td className="px-4 py-2.5">{s.section}</td>
                      <td className="px-4 py-2.5 text-muted-foreground">{s.examName}</td>
                      <td className="px-4 py-2.5">
                        <SubmissionStatusBadge status={s.submissionStatus} />
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {formatSubmittedDate(s.submittedAt)}
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" className="h-8">
                            <Link
                              href={`/examinations/marks?exam=${s.examId}`}
                            >
                              <Eye className="mr-1 h-3.5 w-3.5" />
                              {t("examinationsMonitoring.view")}
                            </Link>
                          </Button>
                          {s.submissionStatus === "PENDING" && (
                            <Button
                              variant="outline"
                              className="h-8"
                              disabled={reminding === key}
                              onClick={() =>
                                void handleReminder(s.examId, s.subjectId, key)
                              }
                            >
                              <Bell className="mr-1 h-3.5 w-3.5" />
                              {reminding === key ? "Sending…" : "Send Reminder"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {(!data || data.subjects.length === 0) && (
                  <tr>
                    <td
                      colSpan={8}
                      className="px-4 py-10 text-center text-muted-foreground"
                    >
                      {t("examinationsMonitoring.noSubjectsToMonitorForThis")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string | number;
  tone?: "success" | "warning" | "info";
}) {
  const colors = {
    success: "text-emerald-600",
    warning: "text-amber-600",
    info: "text-blue-600",
  };
  return (
    <div className="rounded-xl border bg-card p-4 shadow-sm">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-bold tabular-nums ${tone ? colors[tone] : ""}`}>
        {value}
      </p>
    </div>
  );
}
