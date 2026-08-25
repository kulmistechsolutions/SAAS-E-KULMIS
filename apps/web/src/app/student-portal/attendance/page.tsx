"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import {
  apiStudentPortalAttendance,
  type StudentPortalAttendanceRow,
} from "@/lib/student-portal/api";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE: Record<string, "success" | "danger" | "warning" | "muted"> = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
  EXCUSED: "muted",
};

export default function StudentPortalAttendancePage() {
  const t = useT();
  const [rows, setRows] = useState<StudentPortalAttendanceRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    void apiStudentPortalAttendance()
      .then(setRows)
      .finally(() => setLoading(false));
  }, []);

  const stats = useMemo(() => {
    const present = rows.filter((r) => r.status === "PRESENT").length;
    const absent = rows.filter((r) => r.status === "ABSENT").length;
    const late = rows.filter((r) => r.status === "LATE").length;
    const excused = rows.filter((r) => r.status === "EXCUSED").length;
    const percentage = rows.length ? Math.round((present / rows.length) * 100) : 0;
    return { present, absent, late, excused, percentage };
  }, [rows]);

  if (loading) {
    return <p className="text-muted-foreground">{t("studentPortalAttendance.loadingAttendance")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("studentPortalAttendance.attendance")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studentPortalAttendance.lastRecordedDays").replace("{n}", String(rows.length))}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        {[
          { id: "present", label: t("studentPortalAttendance.present"), value: stats.present },
          { id: "absent", label: t("studentPortalAttendance.absent"), value: stats.absent },
          { id: "late", label: t("studentPortalAttendance.late"), value: stats.late },
          { id: "excused", label: t("studentPortalAttendance.excused"), value: stats.excused },
          { id: "rate", label: t("studentPortalAttendance.attendance"), value: `${stats.percentage}%` },
        ].map((c) => (
          <div key={c.id} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className="mt-1 text-xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-start">
              <th className="px-4 py-3">{t("studentPortalAttendance.date")}</th>
              <th className="px-4 py-3">{t("studentPortalAttendance.shift")}</th>
              <th className="px-4 py-3">{t("studentPortalAttendance.status")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-4 py-10 text-center text-muted-foreground">
                  {t("studentPortalAttendance.noAttendanceRecordsYet")}
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{new Date(r.date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-muted-foreground">{r.shift?.name ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={STATUS_TONE[r.status] ?? "muted"}>{r.status}</Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
