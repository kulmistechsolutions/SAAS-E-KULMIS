"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarCheck,
  CalendarDays,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  DollarSign,
  FileText,
  GraduationCap,
  Library,
  LayoutDashboard,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  HeartHandshake,
  ScrollText,
  Settings,
  ShieldCheck,
  TrendingUp,
  TrendingDown,
  UsersRound,
  Wallet,
  MessageSquare,
  Package,
  UserCircle,
  Megaphone,
  type LucideIcon,
} from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useAuth } from "@/lib/auth";
import { isFullAccessRole, isRouteAllowedForRole } from "@/lib/rbac/routes";
import { cn } from "@/lib/utils";

interface NavChild {
  label: string;
  href: string;
}

interface NavItem {
  label: string;
  icon: LucideIcon;
  href?: string;
  children?: NavChild[];
}

const FEE_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/finance" },
  { label: "Collect Fees", href: "/finance/collect" },
  { label: "Fee History", href: "/finance/history" },
  { label: "Monthly Setup", href: "/finance/monthly-setup" },
  { label: "Academic Year Setup", href: "/finance/academic-year-setup" },
  { label: "Reports", href: "/finance/reports" },
  { label: "Receipts", href: "/finance/receipts" },
];

const ACADEMICS_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/academics" },
  { label: "Classes", href: "/academics/classes" },
  { label: "Sections", href: "/academics/sections" },
  { label: "Subjects", href: "/academics/subjects" },
  { label: "Academic Years", href: "/academics/years" },
];

const PROMOTION_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/promotions" },
  { label: "Promote Students", href: "/promotions/promote" },
  { label: "Graduated Students", href: "/promotions/graduated" },
  { label: "History", href: "/promotions/history" },
  { label: "Reports", href: "/promotions/reports" },
  { label: "Eligibility Rules", href: "/promotions/settings" },
];

const SALARY_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/salary" },
  { label: "Monthly Payroll", href: "/salary/payroll" },
  { label: "Employees", href: "/salary/employees" },
  { label: "Salary History", href: "/salary/history" },
  { label: "Reports", href: "/salary/reports" },
];

const QUIZ_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/quiz" },
  { label: "All Quizzes", href: "/quiz/list" },
  { label: "Create Quiz", href: "/quiz/create" },
  { label: "Monitoring", href: "/quiz/monitoring" },
  { label: "Reports", href: "/quiz/reports" },
];

const TEACHER_QUIZ_CHILDREN: NavChild[] = [
  { label: "My Quizzes", href: "/quiz/list" },
  { label: "Create Quiz", href: "/quiz/create" },
  { label: "Reports", href: "/quiz/reports" },
];

const USERS_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/users" },
  { label: "All Users", href: "/users/list" },
  { label: "Roles & Permissions", href: "/users/roles" },
  { label: "Reports", href: "/users/reports" },
];

const EXPENSE_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/expenses" },
  { label: "Expense List", href: "/expenses/list" },
  { label: "Categories", href: "/expenses/categories" },
  { label: "Reports", href: "/expenses/reports" },
];

const EXAM_CHILDREN: NavChild[] = [
  { label: "Dashboard", href: "/examinations" },
  { label: "Create Exam", href: "/examinations/create" },
  { label: "Enter Marks", href: "/examinations/marks" },
  { label: "Monitoring", href: "/examinations/monitoring" },
  { label: "Exam Groups", href: "/examinations/groups" },
  { label: "Results", href: "/examinations/results" },
  { label: "Blocked Students", href: "/examinations/blocked" },
  { label: "Teacher Portal", href: "/examinations/teacher" },
  { label: "Reports", href: "/examinations/reports" },
];

const TEACHER_EXAM_CHILDREN: NavChild[] = [
  { label: "Enter Marks", href: "/examinations/teacher" },
];

const ADMIN_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "Students", icon: UsersRound, href: "/students" },
  { label: "Teachers", icon: GraduationCap, href: "/teachers" },
  { label: "Parents", icon: UsersRound, href: "/parents" },
  { label: "Parent Portal", icon: HeartHandshake, href: "/parent-portal/login" },
  { label: "Teacher Portal", icon: BookOpen, href: "/teacher-portal/login" },
  { label: "Classes & Sections", icon: Library, children: ACADEMICS_CHILDREN },
  { label: "Attendance", icon: CalendarCheck, href: "/attendance" },
  { label: "Fee Management", icon: Wallet, children: FEE_CHILDREN },
  { label: "Salary Management", icon: Receipt, children: SALARY_CHILDREN },
  { label: "Expense Management", icon: TrendingDown, children: EXPENSE_CHILDREN },
  { label: "Examinations", icon: FileText, children: EXAM_CHILDREN },
  { label: "Promotions", icon: TrendingUp, children: PROMOTION_CHILDREN },
  { label: "Online Quiz", icon: ClipboardList, children: QUIZ_CHILDREN },
  { label: "Finance", icon: DollarSign, href: "/finance" },
  { label: "SMS", icon: MessageSquare, href: "/sms" },
  { label: "SMS Packages", icon: Package, href: "/sms/packages" },
  { label: "Library", icon: BookOpen, href: "/library" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
  { label: "Users & Roles", icon: ShieldCheck, children: USERS_CHILDREN },
  { label: "Settings", icon: Settings, href: "/settings" },
  { label: "System Logs", icon: ScrollText },
];

const TEACHER_NAV: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
  { label: "My Profile", icon: UserCircle, href: "/profile" },
  { label: "My Students", icon: UsersRound, href: "/my-students" },
  { label: "My Assignments", icon: CalendarDays, href: "/my-assignments" },
  { label: "Attendance", icon: CalendarCheck, href: "/attendance/students" },
  { label: "Examinations", icon: FileText, children: TEACHER_EXAM_CHILDREN },
  { label: "Online Quiz", icon: ClipboardList, children: TEACHER_QUIZ_CHILDREN },
  { label: "Announcements", icon: Megaphone, href: "/announcements" },
  { label: "Reports", icon: BarChart3, href: "/reports" },
];

const ADMIN_QUICK_LINKS = [
  { label: "Collect Fees", href: "/finance/collect", icon: Wallet },
  { label: "Enter Marks", href: "/examinations/marks", icon: FileText },
  { label: "View Results", href: "/results", icon: GraduationCap },
];

const TEACHER_QUICK_LINKS = [
  { label: "Take Attendance", href: "/attendance/students", icon: CalendarCheck },
  { label: "Enter Marks", href: "/examinations/teacher", icon: FileText },
  { label: "My Students", href: "/my-students", icon: UsersRound },
];

/**
 * Filter the admin nav down to what a non-admin staff role may access:
 * link items are kept when their href is allowed; grouped items keep only
 * their allowed children and are dropped entirely when none remain.
 * Placeholder items (no href, no children) are admin-only.
 */
function scopeNavToRole(nav: NavItem[], role: string): NavItem[] {
  const out: NavItem[] = [];
  for (const item of nav) {
    if (item.children) {
      const children = item.children.filter((c) =>
        isRouteAllowedForRole(role, c.href),
      );
      if (children.length > 0) out.push({ ...item, children });
      continue;
    }
    if (item.href && isRouteAllowedForRole(role, item.href)) {
      out.push(item);
    }
  }
  return out;
}

interface SidebarProps {
  onNavigate?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}

export function Sidebar({
  onNavigate,
  collapsed = false,
  onToggleCollapse,
}: SidebarProps) {
  const pathname = usePathname();
  const branding = useSchoolBranding();
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const role = user?.role ?? "";
  // Admins see everything; teachers use their own nav; every other staff role
  // gets the admin nav filtered to the pages their permissions actually grant.
  const scopedAdminNav =
    !user || isFullAccessRole(role)
      ? ADMIN_NAV
      : scopeNavToRole(ADMIN_NAV, role);
  const NAV = isTeacher ? TEACHER_NAV : scopedAdminNav;
  const QUICK_LINKS = isTeacher
    ? TEACHER_QUICK_LINKS
    : !user || isFullAccessRole(role)
      ? ADMIN_QUICK_LINKS
      : ADMIN_QUICK_LINKS.filter((q) => isRouteAllowedForRole(role, q.href));

  const [openMenus, setOpenMenus] = useState<Record<string, boolean>>(() => ({
    "Classes & Sections": pathname.startsWith("/academics"),
    "Fee Management": pathname.startsWith("/finance"),
    Examinations: pathname.startsWith("/examinations"),
    Promotions: pathname.startsWith("/promotions"),
    "Online Quiz": pathname.startsWith("/quiz"),
  }));

  function matchesPath(href: string): boolean {
    return pathname === href || pathname.startsWith(`${href}/`);
  }

  /**
   * Exactly ONE sibling may be active: the one whose href is the longest
   * matching prefix of the current path. Plain prefix matching lit up both
   * "Dashboard" (/salary) and "Employees" (/salary/employees) at once.
   */
  function isChildActive(child: NavChild, siblings?: NavChild[]): boolean {
    if (!matchesPath(child.href)) return false;
    return !(siblings ?? []).some(
      (s) => s.href.length > child.href.length && matchesPath(s.href),
    );
  }

  function isParentActive(item: NavItem): boolean {
    return item.children?.some((c) => matchesPath(c.href)) ?? false;
  }

  function toggleMenu(label: string) {
    setOpenMenus((prev) => ({ ...prev, [label]: !prev[label] }));
  }

  function defaultHref(item: NavItem): string {
    return item.children?.[0]?.href ?? "/dashboard";
  }

  return (
    <div className="flex h-full flex-col bg-[#111a2e] text-slate-300">
      <div
        className={cn(
          "flex items-center gap-3 border-b border-white/5 py-4",
          collapsed ? "flex-col px-2" : "px-5",
        )}
      >
        <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={branding.logoUrl} alt="" className="h-full w-full object-contain" />
          ) : (
            <GraduationCap className="h-5 w-5" />
          )}
        </span>
        {!collapsed && (
          <div className="min-w-0 leading-tight">
            <p className="truncate text-base font-bold text-white">{branding.name}</p>
            <p className="truncate text-[11px] text-slate-400">
              {isTeacher ? "Teacher Portal" : branding.tagline}
            </p>
          </div>
        )}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className={cn(
              "flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-white/10 hover:text-white",
              collapsed ? "mt-1" : "ml-auto",
            )}
          >
            {collapsed ? (
              <PanelLeftOpen className="h-[18px] w-[18px]" />
            ) : (
              <PanelLeftClose className="h-[18px] w-[18px]" />
            )}
          </button>
        )}
      </div>

      <nav className="scrollbar-slim flex-1 space-y-1 overflow-y-auto overflow-x-hidden px-3 py-4">
        {NAV.map((item) => {
          // Single-child groups become a direct link (e.g. teacher "Examinations").
          if (item.children?.length === 1 && !collapsed) {
            const child = item.children[0]!;
            const active = isChildActive(child);
            return (
              <Link
                key={item.label}
                href={child.href}
                onClick={onNavigate}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-300 hover:bg-white/5 hover:text-white",
                )}
              >
                <item.icon className="h-[18px] w-[18px] shrink-0" />
                <span className="truncate">{item.label}</span>
              </Link>
            );
          }

          if (item.children && !collapsed) {
            const parentActive = isParentActive(item);
            const isOpen = openMenus[item.label] ?? parentActive;
            return (
              <div key={item.label}>
                <button
                  type="button"
                  onClick={() => toggleMenu(item.label)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                    parentActive
                      ? "bg-blue-600/90 text-white"
                      : "text-slate-300 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <item.icon className="h-[18px] w-[18px] shrink-0" />
                  <span className="flex-1 truncate text-left">{item.label}</span>
                  {isOpen ? (
                    <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                  ) : (
                    <ChevronRight className="h-4 w-4 shrink-0 opacity-70" />
                  )}
                </button>
                {isOpen && (
                  <div className="ml-4 mt-1 space-y-0.5 border-l border-white/10 pl-3">
                    {item.children.map((child) => {
                      const active = isChildActive(child, item.children);
                      return (
                        <Link
                          key={child.href}
                          href={child.href}
                          onClick={onNavigate}
                          className={cn(
                            "block rounded-lg px-3 py-2 text-sm transition-colors",
                            active
                              ? "bg-blue-600 text-white font-medium"
                              : "text-slate-400 hover:bg-white/5 hover:text-white",
                          )}
                        >
                          {child.label}
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const active =
            item.href &&
            (item.href === "/finance" ||
            item.href === "/examinations" ||
            item.href === "/academics" ||
            item.href === "/promotions"
              ? pathname === item.href
              : pathname === item.href || pathname.startsWith(`${item.href}/`));
          const className = cn(
            "group/nav relative flex items-center rounded-lg text-sm font-medium transition-colors",
            collapsed ? "justify-center px-0 py-2.5" : "gap-3 px-3 py-2.5",
            active
              ? "bg-blue-600 text-white shadow-sm"
              : "text-slate-300 hover:bg-white/5 hover:text-white",
            !item.href && !item.children && "cursor-default opacity-70 hover:bg-transparent",
          );
          const content = (
            <>
              <item.icon className="h-[18px] w-[18px] shrink-0" />
              {!collapsed && <span className="truncate">{item.label}</span>}
            </>
          );

          if (item.children && collapsed) {
            return (
              <Link
                key={item.label}
                href={defaultHref(item)}
                onClick={onNavigate}
                className={className}
                title={item.label}
              >
                {content}
              </Link>
            );
          }

          return item.href ? (
            <Link
              key={item.label}
              href={item.href}
              onClick={onNavigate}
              className={className}
              title={collapsed ? item.label : undefined}
            >
              {content}
            </Link>
          ) : (
            <span key={item.label} className={className} title="Coming soon">
              {content}
            </span>
          );
        })}

        {!collapsed && (
          <div className="mt-6 border-t border-white/5 pt-4">
            <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              Quick Links
            </p>
            {QUICK_LINKS.map((q) => (
              <Link
                key={q.href}
                href={q.href}
                onClick={onNavigate}
                className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-slate-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <q.icon className="h-4 w-4" />
                {q.label}
              </Link>
            ))}
          </div>
        )}
      </nav>

      <div
        className={cn(
          "border-t border-white/5 py-4",
          collapsed ? "flex flex-col items-center px-2" : "px-5",
        )}
      >
        <div
          className={cn(
            "flex items-center text-sm font-medium text-white",
            collapsed ? "justify-center" : "gap-2",
          )}
        >
          <span className="relative flex h-2.5 w-2.5">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
          </span>
          {!collapsed && "System Status"}
        </div>
        {!collapsed && (
          <>
            <p className="mt-1 text-xs text-slate-400">All Systems Operational</p>
            <p className="mt-3 text-[11px] text-slate-500">v2.5.0</p>
          </>
        )}
      </div>
    </div>
  );
}
