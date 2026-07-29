import { redirect } from "next/navigation";
import { headers } from "next/headers";
import Link from "next/link";
import {
  Banknote,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  MessageSquareText,
  School,
  TrendingUp,
  Users,
} from "lucide-react";
import { BRAND } from "@/lib/brand";

const ROOT_DOMAIN = process.env.APP_ROOT_DOMAIN ?? "ekulmis.local";

function hasTenantSubdomain(host: string): boolean {
  const bare = host.split(":")[0].toLowerCase();
  if (!bare || bare === ROOT_DOMAIN || bare === `www.${ROOT_DOMAIN}`) return false;
  return bare.endsWith(`.${ROOT_DOMAIN}`);
}

const MODULES = [
  {
    icon: Users,
    title: "Students & Parents",
    description: "Full student profiles, parent accounts, promotions, and a dedicated parent portal.",
  },
  {
    icon: GraduationCap,
    title: "Teachers & Staff",
    description: "Assignments, timetables, attendance, and payroll for every teacher and staff member.",
  },
  {
    icon: ClipboardList,
    title: "Examinations & Results",
    description: "Exam creation, mark entry, weighted exam groups, printable report cards, and a public results portal.",
  },
  {
    icon: CalendarCheck,
    title: "Attendance & Timetable",
    description: "Daily student and teacher attendance, plus a full class timetable builder.",
  },
  {
    icon: Banknote,
    title: "Fees & Finance",
    description: "Monthly fee billing, payments, expenses, salaries, and a live finance dashboard.",
  },
  {
    icon: MessageSquareText,
    title: "SMS Notifications",
    description: "Reach parents directly with attendance, fee, and result notifications by SMS.",
  },
  {
    icon: TrendingUp,
    title: "Quizzes & Assessments",
    description: "Auto-graded quizzes with multiple question types for ongoing student assessment.",
  },
  {
    icon: LayoutDashboard,
    title: "Dashboards & Reports",
    description: "Real-time dashboards for administrators, teachers, and finance — no spreadsheets needed.",
  },
];

/** Root path: schools land on their own subdomain's login; the bare root
 *  domain has no tenant, so it shows this public overview page instead. */
export default async function Home() {
  const host = (await headers()).get("host") ?? "";
  if (hasTenantSubdomain(host)) {
    const preview = process.env.NEXT_PUBLIC_PREVIEW_AUTH === "true";
    redirect(preview ? "/dashboard" : "/login");
  }

  return (
    <main className="min-h-screen bg-secondary/20">
      <header className="border-b bg-card/60 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4 sm:px-8">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
              <School className="h-5 w-5" />
            </span>
            <span className="text-lg font-bold">{BRAND.name}</span>
          </div>
          <Link
            href="/login"
            className="inline-flex h-9 items-center justify-center rounded-lg border px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            School sign in
          </Link>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-8 sm:py-24">
        <h1 className="text-3xl font-bold tracking-tight sm:text-5xl">
          {BRAND.tagline}
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-muted-foreground sm:text-lg">
          {BRAND.name} is a complete, multi-tenant school management platform —
          students, teachers, exams, attendance, fees, and communication, all
          in one system built for schools of any size.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/login"
            className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
          >
            School sign in
          </Link>
          <Link
            href="/results"
            className="inline-flex h-11 items-center justify-center rounded-lg border px-6 text-sm font-semibold transition-colors hover:bg-secondary"
          >
            Look up a student result
          </Link>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 pb-16 sm:px-8 sm:pb-24">
        <div className="mb-8 text-center">
          <h2 className="text-2xl font-bold">Everything a school needs</h2>
          <p className="mt-2 text-muted-foreground">One platform, every part of running a school.</p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {MODULES.map((m) => (
            <div
              key={m.title}
              className="rounded-2xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <m.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-3 font-semibold">{m.title}</h3>
              <p className="mt-1.5 text-sm text-muted-foreground">{m.description}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-t bg-card/60">
        <div className="mx-auto max-w-6xl px-4 py-12 text-center sm:px-8">
          <h2 className="text-xl font-bold">Already a registered school?</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Every school gets its own private address — staff, teachers, and
            parents sign in at <span className="font-mono">yourschool.{ROOT_DOMAIN}</span>.
          </p>
        </div>
      </section>

      <footer className="px-4 py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name}. All rights reserved.
      </footer>
    </main>
  );
}
