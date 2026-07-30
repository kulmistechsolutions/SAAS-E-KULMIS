"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Bell,
  BookOpen,
  CalendarCheck,
  ClipboardList,
  FileText,
  GraduationCap,
  Library,
  Megaphone,
  UserCircle,
  Users,
} from "lucide-react";
import {
  apiTeacherDashboard,
  type TeacherDashboardResponse,
} from "@/lib/dashboard/api";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function formatToday(iso: string) {
  try {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function TeacherDashboard({
  portalMode = false,
  canViewStudents = true,
}: {
  portalMode?: boolean;
  canViewStudents?: boolean;
}) {
  const t = useT();
  const branding = useSchoolBranding();
  const base = portalMode ? "/teacher-portal" : "";
  const [data, setData] = useState<TeacherDashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiTeacherDashboard()
      .then(setData)
      .catch(() => toast("Failed to load teacher dashboard", "error"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!data) {
    return (
      <p className="text-center text-muted-foreground">
        {t("dashboardTeacherDashboard.couldNotLoadYourDashboard")}
      </p>
    );
  }

  const stats = [
    { label: "Assigned Classes", value: data.stats.classes, icon: GraduationCap },
    { label: "Assigned Sections", value: data.stats.sections, icon: Library },
    { label: "Assigned Subjects", value: data.stats.subjects, icon: BookOpen },
    { label: "Active Examinations", value: data.stats.activeExams, icon: FileText },
    {
      label: "Pending Submissions",
      value: data.stats.pendingSubmissions,
      icon: FileText,
    },
    { label: "Active Quizzes", value: data.stats.activeQuizzes, icon: ClipboardList },
    {
      label: "Completed Quizzes",
      value: data.stats.completedQuizzes,
      icon: ClipboardList,
    },
    {
      label: "Today's Attendance",
      value: `${data.attendanceToday.percentage}%`,
      icon: CalendarCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <section className="flex flex-wrap items-center gap-4 rounded-2xl border bg-card p-5 shadow-sm">
        <span className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl bg-primary/10 text-primary">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt=""
              className="h-full w-full object-contain"
            />
          ) : (
            <GraduationCap className="h-7 w-7" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {data.school.name || branding.name}
          </p>
          <h1 className="truncate text-2xl font-bold">
            {t("dashboardTeacherDashboard.welcome")} {data.teacher.fullName}
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("dashboardTeacherDashboard.teacherId")} {data.teacher.code} · {data.teacher.shift} {t("dashboardTeacherDashboard.shift")}{" "}
            {formatToday(data.today)}
          </p>
        </div>
        <Link
          href={`${base}/profile`}
          className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium hover:bg-muted/50"
        >
          <UserCircle className="h-4 w-4" />
          {t("dashboardTeacherDashboard.myProfile")}
        </Link>
      </section>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div
            key={s.label}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-sm"
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <s.icon className="h-5 w-5" />
            </span>
            <div className="min-w-0">
              <p className="text-xl font-bold tabular-nums">{s.value}</p>
              <p className="truncate text-xs text-muted-foreground">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {[
          { href: `${base}/attendance`, label: "Take attendance" },
          { href: `${base}/exams/marks`, label: "Enter marks" },
          ...(canViewStudents
            ? [{ href: `${base}/students`, label: "My students" }]
            : []),
          { href: `${base}/assignments`, label: "My assignments" },
          { href: `${base}/quizzes/create`, label: "Create quiz" },
        ].map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="rounded-lg border bg-card px-4 py-2 text-sm font-medium hover:bg-muted/50"
          >
            {q.label}
          </Link>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Widget title={t("dashboardTeacherDashboard.upcomingExams")} icon={FileText} href={`${base}/exams/marks`}>
          {data.upcomingExams.length === 0 ? (
            <Empty>{t("dashboardTeacherDashboard.noUpcomingExams")}</Empty>
          ) : (
            <ul className="space-y-3">
              {data.upcomingExams.map((e) => (
                <li key={e.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <p className="font-medium">{e.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {e.className}
                    {e.section ? ` · ${e.section}` : ""} ·{" "}
                    {e.subjects.join(", ") || "—"}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title={t("dashboardTeacherDashboard.activeQuizzes")} icon={ClipboardList} href={`${base}/quizzes`}>
          {data.activeQuizzes.length === 0 ? (
            <Empty>{t("dashboardTeacherDashboard.noActiveQuizzes")}</Empty>
          ) : (
            <ul className="space-y-3">
              {data.activeQuizzes.map((q) => (
                <li key={q.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <Link
                    href={`${base}/quizzes/${q.id}`}
                    className="font-medium hover:underline"
                  >
                    {q.title}
                  </Link>
                  <p className="text-xs text-muted-foreground">
                    {q.className}
                    {q.section ? ` · ${q.section}` : ""} · {q.status} · {q.code}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title={t("dashboardTeacherDashboard.notifications")} icon={Bell} href={`${base}/notifications`}>
          {data.notifications.length === 0 ? (
            <Empty>{t("dashboardTeacherDashboard.noRecentNotifications")}</Empty>
          ) : (
            <ul className="space-y-3">
              {data.notifications.map((n) => (
                <li key={n.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <p className="font-medium">{n.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {n.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>

        <Widget title={t("dashboardTeacherDashboard.schoolAnnouncements")} icon={Megaphone} href={`${base}/announcements`}>
          {data.announcements.length === 0 ? (
            <Empty>{t("dashboardTeacherDashboard.noAnnouncements")}</Empty>
          ) : (
            <ul className="space-y-3">
              {data.announcements.map((a) => (
                <li key={a.id} className="border-b pb-3 last:border-0 last:pb-0">
                  <p className="font-medium">{a.title}</p>
                  <p className="line-clamp-2 text-xs text-muted-foreground">
                    {a.body}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </Widget>
      </div>

      <section className="rounded-xl border bg-card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-semibold">{t("dashboardTeacherDashboard.assignedClassesSubjects")}</h2>
          <Link
            href={`${base}/assignments`}
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("dashboardTeacherDashboard.viewAll")}
          </Link>
        </div>
        {data.schedule.length === 0 ? (
          <Empty>{t("dashboardTeacherDashboard.noAssignmentsYet")}</Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-start text-muted-foreground">
                  <th className="pb-2 pe-3 font-medium">{t("dashboardTeacherDashboard.year")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("dashboardTeacherDashboard.class")}</th>
                  <th className="pb-2 pe-3 font-medium">{t("dashboardTeacherDashboard.section")}</th>
                  <th className="pb-2 font-medium">{t("dashboardTeacherDashboard.subject")}</th>
                </tr>
              </thead>
              <tbody>
                {data.schedule.slice(0, 10).map((a) => (
                  <tr key={a.id} className="border-b last:border-0">
                    <td className="py-2 pe-3">{a.academicYear}</td>
                    <td className="py-2 pe-3">{a.className}</td>
                    <td className="py-2 pe-3">{a.section ?? "All"}</td>
                    <td className="py-2">{a.subject}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {canViewStudents && (
        <div className="flex items-center gap-3 rounded-xl border bg-card p-4 text-sm">
          <Users className="h-5 w-5 text-primary" />
          <span>
            <strong>{data.stats.students}</strong> {t("dashboardTeacherDashboard.studentsInYourAssignedClasses")}{" "}
            <Link href={`${base}/students`} className="text-primary hover:underline">
              {t("dashboardTeacherDashboard.openStudentList")}
            </Link>
          </span>
        </div>
      )}
    </div>
  );
}

function Widget({
  title,
  icon: Icon,
  href,
  children,
}: {
  title: string;
  icon: typeof FileText;
  href: string;
  children: React.ReactNode;
}) {
  const t = useT();
  return (
    <section className="rounded-xl border bg-card p-5">
      <div className="mb-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          <h2 className="font-semibold">{title}</h2>
        </div>
        <Link
          href={href}
          className={cn("text-xs font-medium text-primary hover:underline")}
        >
          {t("dashboardTeacherDashboard.view")}
        </Link>
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}
