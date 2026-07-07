"use client";

import Link from "next/link";
import { CalendarCheck, GraduationCap, Users } from "lucide-react";

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
];

export default function AttendanceHubPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Attendance</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Record and monitor daily attendance for students and teachers.
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
              <CalendarCheck className="h-4 w-4" /> Open module →
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
}
