"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { CalendarCheck, Clock, GraduationCap, Users } from "lucide-react";

const SECTIONS = [
  {
    title: "Student Attendance",
    description: "Mark daily attendance by class and section. View reports and history.",
    href: "/attendance/students",
    icon: Users,
    color: "from-blue-500 to-indigo-600",
  },
  {
    title: "Teacher Attendance",
    description: "Mark morning and afternoon shift attendance. Track teacher presence.",
    href: "/attendance/teachers",
    icon: GraduationCap,
    color: "from-violet-500 to-purple-600",
  },
  {
    title: "Attendance Shift Management",
    description: "Set up the sessions your school takes attendance for, e.g. Morning and Afternoon.",
    href: "/attendance/shifts",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
  },
];

export default function AttendanceHubPage() {
  const t = useT();
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("attendance.attendance")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("attendance.recordAndMonitorDailyAttendanceFor")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group flex flex-col rounded-2xl border bg-card p-6 shadow-sm transition-all hover:-translate-y-1 hover:shadow-md"
          >
            <span
              className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${s.color} text-white shadow-lg transition-transform group-hover:scale-110`}
            >
              <s.icon className="h-7 w-7" />
            </span>
            <h2 className="text-lg font-semibold">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm text-muted-foreground">{s.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-primary">
              <CalendarCheck className="h-4 w-4" /> {t("attendance.openModule")}
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
