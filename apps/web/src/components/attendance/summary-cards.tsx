import { useT } from "@/lib/i18n/provider";
import type { AttendanceSummary } from "@/lib/attendance/store";
import {
  CalendarCheck,
  Clock,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { shiftName, useShifts } from "@/lib/teachers/shifts";

export function StudentAttendanceSummaryCards({
  summary,
}: {
  summary: AttendanceSummary & { totalStudents?: number };
}) {
  const t = useT();
  const cards: { label: string; value: string | number; icon: LucideIcon; chip: string }[] = [
    { label: t("attendanceSummaryCards.totalStudents"), value: summary.totalStudents ?? summary.total, icon: Users, chip: "bg-violet-500/15 text-violet-600" },
    { label: t("attendanceSummaryCards.presentToday"), value: summary.present, icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600" },
    { label: t("attendanceSummaryCards.absentToday"), value: summary.absent, icon: UserX, chip: "bg-rose-500/15 text-rose-600" },
    { label: t("attendanceSummaryCards.lateToday"), value: summary.late, icon: Clock, chip: "bg-amber-500/15 text-amber-600" },
    { label: t("attendanceSummaryCards.excusedToday"), value: summary.excused, icon: CalendarCheck, chip: "bg-sky-500/15 text-sky-600" },
    { label: t("attendanceSummaryCards.attendance"), value: `${summary.percentage}%`, icon: UserCheck, chip: "bg-indigo-500/15 text-indigo-600" },
  ];
  return <CardGrid cards={cards} />;
}

export function TeacherAttendanceSummaryCards({
  summary,
}: {
  summary: AttendanceSummary & {
    totalTeachers?: number;
    byShift?: { id: string; count: number }[];
  };
}) {
  const t = useT();
  useShifts(); // subscribe so shift-name labels below update once loaded
  const cards: { label: string; value: string | number; icon: LucideIcon; chip: string }[] = [
    { label: t("attendanceSummaryCards.totalTeachers"), value: summary.totalTeachers ?? summary.total, icon: Users, chip: "bg-violet-500/15 text-violet-600" },
    ...(summary.byShift ?? []).map((s) => ({
      label: shiftName(s.id),
      value: s.count,
      icon: Clock,
      chip: "bg-amber-500/15 text-amber-600",
    })),
    { label: t("attendanceSummaryCards.presentToday"), value: summary.present, icon: UserCheck, chip: "bg-emerald-500/15 text-emerald-600" },
    { label: t("attendanceSummaryCards.absentToday"), value: summary.absent, icon: UserX, chip: "bg-rose-500/15 text-rose-600" },
    { label: t("attendanceSummaryCards.attendance"), value: `${summary.percentage}%`, icon: CalendarCheck, chip: "bg-indigo-500/15 text-indigo-600" },
  ];
  return <CardGrid cards={cards} />;
}

function CardGrid({
  cards,
}: {
  cards: { label: string; value: string | number; icon: LucideIcon; chip: string }[];
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <span className={cn("flex h-9 w-9 items-center justify-center rounded-lg", c.chip)}>
              <c.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="text-2xl font-bold tabular-nums">{c.value}</span>
          </div>
          <p className="mt-2 text-xs font-medium text-muted-foreground">{c.label}</p>
        </div>
      ))}
    </div>
  );
}
