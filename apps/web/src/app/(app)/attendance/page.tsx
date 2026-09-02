"use client";

import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import {
  CalendarCheck,
  Clock,
  GraduationCap,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";
import { useAuth } from "@/lib/auth";
import { isFullAccessRole } from "@/lib/rbac/routes";

interface HubCard {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  color: string;
  /** Roles this card is for. Undefined means everyone who can open the hub. */
  roles?: string[];
}

/**
 * The attendance module's front door.
 *
 * Cards are filtered by role rather than shown to everyone. An officer who
 * clicks "Attendance Officers" or "Shift Management" gets a 403 from the API —
 * the server is not the problem, but offering somebody a door that will be
 * shut in their face is its own kind of broken, and it also tells them the
 * school has settings they were not meant to know about.
 */
const SECTIONS: HubCard[] = [
  {
    title: "My Classes",
    description:
      "The registers you have been assigned, and which of them you have still to take today.",
    href: "/attendance/my-classes",
    icon: CalendarCheck,
    color: "from-emerald-500 to-teal-600",
    roles: ["ATTENDANCE_OFFICER"],
  },
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
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
  {
    title: "Attendance Shift Management",
    description:
      "Set up the sessions your school takes attendance for, e.g. Morning and Afternoon.",
    href: "/attendance/shifts",
    icon: Clock,
    color: "from-amber-500 to-orange-600",
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
  {
    title: "Attendance Officers",
    description:
      "Choose which classes, sections and shifts each officer may take attendance for.",
    href: "/attendance/officers",
    icon: ShieldCheck,
    color: "from-rose-500 to-pink-600",
    roles: ["ADMINISTRATOR", "SUPER_ADMINISTRATOR"],
  },
];

export default function AttendanceHubPage() {
  const t = useT();
  const { user } = useAuth();
  const role = user?.role ?? "";
  const sections = SECTIONS.filter(
    (s) => !s.roles || isFullAccessRole(role) || s.roles.includes(role),
  );

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">{t("attendance.attendance")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("attendance.recordAndMonitorDailyAttendanceFor")}
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sections.map((s) => (
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
