"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import {
  usePortal,
  usePortalAudit,
} from "@/components/parent-portal/portal-context";
import { printAttendanceReport } from "@/lib/parent-portal/print";
import {
  loadPortalAttendanceHistory,
  type AttendanceSummary,
} from "@/lib/students/history";
import { shortDate } from "@/lib/students/format";
import { Badge } from "@/components/ui/badge";

const STATUS_TONE = {
  PRESENT: "success",
  ABSENT: "danger",
  LATE: "warning",
} as const;

export default function ParentAttendancePage() {
  const { selectedChild } = usePortal();
  usePortalAudit("ATTENDANCE_VIEWED", selectedChild?.id);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("ALL");
  const [range, setRange] = useState("30");

  const [att, setAtt] = useState<AttendanceSummary | null>(null);

  useEffect(() => {
    if (!selectedChild) {
      setAtt(null);
      return;
    }
    const days = Number(range) || 30;
    void loadPortalAttendanceHistory(selectedChild.id, days).then(setAtt);
  }, [selectedChild, range]);

  const rows = useMemo(() => {
    if (!att) return [];
    return att.rows.filter((r) => {
      if (filter !== "ALL" && r.status !== filter) return false;
      if (
        search &&
        !shortDate(r.date).toLowerCase().includes(search.toLowerCase())
      )
        return false;
      return true;
    });
  }, [att, filter, search]);

  if (!selectedChild) {
    return (
      <p className="text-muted-foreground">
        Select a child to view attendance.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {selectedChild.fullName} · {selectedChild.className}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={() => printAttendanceReport(selectedChild)}>
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
          <Button onClick={() => printAttendanceReport(selectedChild)}>
            <Download className="mr-2 h-4 w-4" />
            PDF
          </Button>
        </div>
      </div>

      {att && (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Present", value: att.present, tone: "success" as const },
            { label: "Absent", value: att.absent, tone: "danger" as const },
            { label: "Late", value: att.late, tone: "warning" as const },
            {
              label: "Rate",
              value: `${att.percentage}%`,
              tone: "info" as const,
            },
          ].map((c) => (
            <div
              key={c.label}
              className="rounded-xl border bg-card p-4 text-center"
            >
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="text-2xl font-bold">{c.value}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="Search by date…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <Select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 w-36"
        >
          <option value="ALL">All statuses</option>
          <option value="PRESENT">Present</option>
          <option value="ABSENT">Absent</option>
          <option value="LATE">Late</option>
        </Select>
        <Select
          value={range}
          onChange={(e) => setRange(e.target.value)}
          className="h-9 w-36"
        >
          <option value="30">Last 30 days</option>
          <option value="60">Last 60 days</option>
          <option value="90">Last 90 days</option>
        </Select>
      </div>

      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-secondary/50 text-left">
              <th className="px-4 py-3 font-medium">Date</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.date} className="border-b last:border-0">
                <td className="px-4 py-3">{shortDate(r.date)}</td>
                <td className="px-4 py-3">
                  <Badge tone={STATUS_TONE[r.status]}>{r.status}</Badge>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td
                  colSpan={2}
                  className="px-4 py-8 text-center text-muted-foreground"
                >
                  No attendance records match your filters.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
