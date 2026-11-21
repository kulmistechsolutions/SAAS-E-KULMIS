"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  DollarSign,
  FileBarChart2,
  FileText,
  GraduationCap,
  LayoutGrid,
  Layers,
  PieChart,
  Search,
  TrendingUp,
  Trophy,
  Users,
  Wallet,
} from "lucide-react";
import {
  REPORT_CATEGORIES,
  searchReports,
  searchTeacherReports,
  teacherReportCategories,
} from "@/lib/reports/catalog";
import type { ReportCategoryDef } from "@/lib/reports/types";
import { activeAcademicYear } from "@/lib/academics/store";
import { useAuth } from "@/lib/auth";
import { isRouteAllowedForRole } from "@/lib/rbac/routes";
import type { LucideIcon } from "lucide-react";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

/**
 * Each category's look: its icon, the tint of its icon tile, and the soft
 * wash in the card's top corner. Classes are written out in full so Tailwind
 * keeps them.
 */
const THEME: Record<
  string,
  { icon: LucideIcon; tile: string; wash: string }
> = {
  students: {
    icon: Users,
    tile: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
    wash: "from-blue-400/25",
  },
  teachers: {
    icon: GraduationCap,
    tile: "bg-violet-500/10 text-violet-600 dark:text-violet-400",
    wash: "from-violet-400/25",
  },
  attendance: {
    icon: CalendarCheck,
    tile: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    wash: "from-emerald-400/25",
  },
  fees: {
    icon: Layers,
    tile: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    wash: "from-amber-400/30",
  },
  examinations: {
    icon: FileText,
    tile: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
    wash: "from-rose-400/25",
  },
  promotions: {
    icon: TrendingUp,
    tile: "bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    wash: "from-fuchsia-400/25",
  },
  salary: {
    icon: Wallet,
    tile: "bg-teal-500/10 text-teal-600 dark:text-teal-400",
    wash: "from-teal-400/25",
  },
  expenses: {
    icon: BarChart3,
    tile: "bg-sky-500/10 text-sky-600 dark:text-sky-400",
    wash: "from-sky-400/25",
  },
  financial: {
    icon: DollarSign,
    tile: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400",
    wash: "from-indigo-400/25",
  },
  quiz: {
    icon: Trophy,
    tile: "bg-orange-500/10 text-orange-600 dark:text-orange-400",
    wash: "from-orange-400/25",
  },
};
const FALLBACK = THEME.students!;

/** Reports shown on a card before "Show N more". */
const PREVIEW = 5;

/** The four headline counts after Total, in this order when present. */
const STAT_IDS = ["students", "teachers", "attendance", "fees"];

export default function ReportsDashboardPage() {
  const t = useT();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const mounted = useHydrated();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  // A category is only listed when the role may actually open it. Fee,
  // salary and financial reporting is not part of holding a register or an
  // exam timetable, and listing it there described the school's money to
  // people who were then refused at the door.
  const role = user?.role ?? "";
  // Teachers are scoped by teacherReportCategories() and are a portal role,
  // which the route guard refuses outright — running them through it too
  // would leave them with no reports at all.
  const allowed = useMemo(
    () => (id: string) =>
      isTeacher || isRouteAllowedForRole(role, `/reports/${id}`),
    [role, isTeacher],
  );
  const categories = useMemo(
    () =>
      (isTeacher ? teacherReportCategories() : REPORT_CATEGORIES).filter((c) =>
        allowed(c.id),
      ),
    [isTeacher, allowed],
  );
  const results = useMemo(
    () =>
      (isTeacher ? searchTeacherReports(query) : searchReports(query)).filter(
        ({ category }) =>
          allowed(category.id) &&
          (!categoryFilter || category.id === categoryFilter),
      ),
    [query, isTeacher, allowed, categoryFilter],
  );
  const shown = categoryFilter
    ? categories.filter((c) => c.id === categoryFilter)
    : categories;
  const year = mounted ? activeAcademicYear() : "";
  const count = categories.reduce((n, c) => n + c.reports.length, 0);
  const stats = STAT_IDS.map((id) => categories.find((c) => c.id === id)).filter(
    (c): c is ReportCategoryDef => !!c,
  );

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("reports.loadingReportsCenter")}
      </div>
    );
  }

  return (
    <div className="relative space-y-6">
      {/* A soft lilac wash behind the header, as on the rest of the page. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-4 -top-4 h-80 rounded-b-[3rem] bg-gradient-to-br from-violet-200/50 via-indigo-100/30 to-transparent dark:from-violet-900/25 dark:via-indigo-900/10 sm:-inset-x-6"
      />

      {/* ── Header ── */}
      <div className="relative flex items-center justify-between gap-6">
        <div className="flex min-w-0 items-center gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-violet-500 to-indigo-600 text-white shadow-lg shadow-violet-500/30">
            <BarChart3 className="h-7 w-7" />
          </span>
          <div className="min-w-0">
            <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">
              {isTeacher ? (
                <>
                  My{" "}
                  <span className="text-violet-600 dark:text-violet-400">Reports</span>
                </>
              ) : (
                <>
                  Reports{" "}
                  <span className="text-violet-600 dark:text-violet-400">Center</span>
                </>
              )}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {isTeacher
                ? `${count} reports for your assigned classes and subjects.`
                : `Centralized analytics — ${count} reports across ${categories.length} categories.`}{" "}
              {t("reports.academicYear")} {year}.
            </p>
          </div>
        </div>
        <HeroArt />
      </div>

      {/* ── Headline counts ── */}
      {!isTeacher && (
        <div className="relative grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <StatCard
            icon={Users}
            tile="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400"
            label="Total Reports"
            value={count}
            note={`${categories.length} Categories`}
          />
          {stats.map((c) => {
            const th = THEME[c.id] ?? FALLBACK;
            return (
              <StatCard
                key={c.id}
                icon={th.icon}
                tile={th.tile}
                label={c.label}
                value={c.reports.length}
                onClick={() => setCategoryFilter(c.id)}
              />
            );
          })}
        </div>
      )}

      {/* ── Search and filters ── */}
      <div className="relative flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute start-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("reports.searchReportsByNameOrCategory")}
            className="h-11 w-full rounded-xl border bg-card ps-10 pe-4 text-sm shadow-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <div className="flex gap-3">
          <label className="relative flex h-11 min-w-0 flex-1 items-center rounded-xl border bg-card shadow-sm sm:w-48 sm:flex-none">
            <LayoutGrid className="pointer-events-none absolute start-3.5 h-4 w-4 text-muted-foreground" />
            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              aria-label="Category"
              className="h-full w-full appearance-none rounded-xl bg-transparent ps-10 pe-9 text-sm outline-none focus:ring-2 focus:ring-primary/20"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.label}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute end-3 h-4 w-4 text-muted-foreground" />
          </label>
          <div className="hidden h-11 items-center gap-2 rounded-xl border bg-card px-4 text-sm shadow-sm md:flex">
            <CalendarDays className="h-4 w-4 text-muted-foreground" />
            <span className="whitespace-nowrap">
              {t("reports.academicYear")}{" "}
              <span className="font-semibold">{year}</span>
            </span>
          </div>
        </div>
      </div>

      {/* ── Results or category cards ── */}
      {query.trim() ? (
        <div className="relative rounded-2xl border bg-card shadow-sm">
          <div className="border-b px-5 py-3 text-sm font-medium">
            {t("reports.searchResults")}{results.length})
          </div>
          <ul className="divide-y">
            {results.length === 0 ? (
              <li className="px-5 py-10 text-center text-sm text-muted-foreground">
                {t("reports.noReportsFound")}
              </li>
            ) : (
              results.map(({ category, report }) => {
                const th = THEME[category.id] ?? FALLBACK;
                const Icon = th.icon;
                return (
                  <li key={`${category.id}-${report.slug}`}>
                    <Link
                      href={`/reports/${category.id}/${report.slug}`}
                      className="flex items-center gap-3 px-5 py-3 hover:bg-muted/40"
                    >
                      <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", th.tile)}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium">{report.title}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {category.label} · {report.description}
                        </p>
                      </div>
                      <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground rtl:rotate-180" />
                    </Link>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      ) : (
        <div className="relative grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {shown.map((cat) => (
            <CategoryCard key={cat.id} cat={cat} reportsWord={t("reports.reports")} />
          ))}
        </div>
      )}
    </div>
  );
}

function StatCard({
  icon: Icon,
  tile,
  label,
  value,
  note,
  onClick,
}: {
  icon: LucideIcon;
  tile: string;
  label: string;
  value: number;
  note?: string;
  onClick?: () => void;
}) {
  const body = (
    <>
      <span className={cn("flex h-11 w-11 shrink-0 items-center justify-center rounded-xl", tile)}>
        <Icon className="h-5 w-5" />
      </span>
      <div className="min-w-0 text-start">
        <p className="truncate text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-2xl font-bold tabular-nums leading-tight">{value}</p>
        {note && (
          <p className="mt-0.5 inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-400">
            <TrendingUp className="h-3 w-3" />
            {note}
          </p>
        )}
      </div>
    </>
  );
  const cls =
    "flex items-center gap-3 rounded-2xl border bg-card/90 p-4 shadow-sm backdrop-blur";
  return onClick ? (
    <button type="button" onClick={onClick} className={cn(cls, "transition hover:-translate-y-0.5 hover:shadow-md")}>
      {body}
    </button>
  ) : (
    <div className={cls}>{body}</div>
  );
}

function CategoryCard({
  cat,
  reportsWord,
}: {
  cat: ReportCategoryDef;
  reportsWord: string;
}) {
  const [open, setOpen] = useState(false);
  const th = THEME[cat.id] ?? FALLBACK;
  const Icon = th.icon;
  const extra = cat.reports.length - PREVIEW;
  const list = open ? cat.reports : cat.reports.slice(0, PREVIEW);

  return (
    <div className="relative overflow-hidden rounded-2xl border bg-card p-5 shadow-sm transition hover:shadow-md">
      {/* The coloured wash in the top corner. */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -end-10 -top-12 h-32 w-56 rotate-[-8deg] rounded-full bg-gradient-to-l to-transparent blur-xl",
          th.wash,
        )}
      />
      <div className="relative mb-3 flex items-center gap-3">
        <span className={cn("flex h-12 w-12 items-center justify-center rounded-xl", th.tile)}>
          <Icon className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-base font-semibold">{cat.label}</h2>
          <p className="text-xs text-muted-foreground">
            {cat.reports.length} {reportsWord}
          </p>
        </div>
      </div>
      <p className="relative mb-3 text-sm text-muted-foreground">{cat.description}</p>

      <ul className="relative divide-y border-t">
        {list.map((r) => (
          <li key={r.slug}>
            <Link
              href={`/reports/${cat.id}/${r.slug}`}
              title={r.description}
              className="group flex items-center justify-between gap-3 py-2 text-sm text-primary"
            >
              <span className="truncate group-hover:underline">{r.title}</span>
              <ArrowRight className="h-4 w-4 shrink-0 transition group-hover:translate-x-0.5 rtl:rotate-180" />
            </Link>
          </li>
        ))}
      </ul>

      {/* Every report stays reachable from the card: the rest open in place
          rather than behind a "+10 more" that led nowhere. */}
      {extra > 0 && (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="relative mt-3 inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 text-xs font-medium text-primary shadow-sm hover:bg-muted/50"
        >
          {open ? "Show fewer reports" : `Show ${extra} more report${extra === 1 ? "" : "s"}`}
          <ChevronDown className={cn("h-3.5 w-3.5 transition", open && "rotate-180")} />
        </button>
      )}
    </div>
  );
}

/** The decorative stack of report sheets at the header's end. */
function HeroArt() {
  return (
    <div aria-hidden className="relative hidden h-28 w-44 shrink-0 md:block">
      <div className="absolute end-14 top-6 h-20 w-28 -rotate-12 rounded-xl border border-white/60 bg-gradient-to-br from-indigo-400 to-violet-500 p-3 shadow-xl dark:border-white/10">
        <div className="space-y-1.5">
          <div className="h-1.5 w-12 rounded bg-white/70" />
          <div className="h-1.5 w-16 rounded bg-white/50" />
          <div className="h-1.5 w-10 rounded bg-white/50" />
        </div>
      </div>
      <div className="absolute end-0 top-0 flex h-24 w-32 rotate-6 flex-col justify-between rounded-xl border bg-card/95 p-3 shadow-2xl">
        <div className="flex h-10 items-end gap-1.5">
          <div className="w-3 rounded-sm bg-violet-300 dark:bg-violet-700" style={{ height: "40%" }} />
          <div className="w-3 rounded-sm bg-violet-400 dark:bg-violet-600" style={{ height: "65%" }} />
          <div className="w-3 rounded-sm bg-violet-500" style={{ height: "50%" }} />
          <div className="w-3 rounded-sm bg-indigo-600" style={{ height: "95%" }} />
        </div>
        <div className="flex items-center gap-2">
          <PieChart className="h-5 w-5 text-violet-500" />
          <div className="space-y-1">
            <div className="h-1 w-12 rounded bg-muted-foreground/30" />
            <div className="h-1 w-8 rounded bg-muted-foreground/20" />
          </div>
        </div>
      </div>
      <FileBarChart2 className="absolute bottom-0 start-2 h-5 w-5 text-violet-400/60" />
    </div>
  );
}
