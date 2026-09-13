"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import Link from "next/link";
import {
  Banknote,
  Eye,
  GraduationCap,
  Lock,
  Pencil,
  Plus,
  Receipt,
  Trash2,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { EmployeeFormDialog } from "@/components/salary/employee-form-dialog";
import { money } from "@/lib/salary/format";
import { useTeachersState } from "@/lib/teachers/store";
import { deleteEmployee, useEmployeesState } from "@/lib/employees/store";
import type { StaffEmployee } from "@/lib/employees/types";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";


interface Row {
  id: string;
  code: string;
  fullName: string;
  type: "TEACHER" | "STAFF";
  position: string;
  phone: string | null;
  salary: number;
  status: "ACTIVE" | "INACTIVE";
  employee?: StaffEmployee;
}

export default function SalaryEmployeesPage() {
  const t = useT();
  const mounted = useHydrated();
  const teachersState = useTeachersState();
  const employeesState = useEmployeesState();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"TEACHER" | "STAFF" | "">("");
  const [status, setStatus] = useState<"ACTIVE" | "INACTIVE" | "">("");
  const [page, setPage] = useState(1);
  // How many rows at once. A list of thirteen pages is thirteen clicks
  // to read, and reading all of it is usually why it was opened.
  const [pageSize, setPageSize] = useState(15);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffEmployee | null>(null);
  const [deleting, setDeleting] = useState<StaffEmployee | null>(null);


  const rows: Row[] = useMemo(() => {
    if (!mounted) return [];
    const teacherRows: Row[] = teachersState.teachers.map((tch) => ({
      id: tch.id,
      code: tch.code,
      fullName: tch.fullName,
      type: "TEACHER",
      position: "Teacher",
      phone: tch.phone ?? null,
      salary: tch.salary,
      status: tch.status,
    }));
    const staffRows: Row[] = employeesState.employees.map((e) => ({
      id: e.id,
      code: e.code,
      fullName: e.fullName,
      type: "STAFF",
      position: e.position,
      phone: e.phone,
      salary: e.salary,
      status: e.status,
      employee: e,
    }));
    return [...teacherRows, ...staffRows];
  }, [mounted, teachersState.teachers, employeesState.employees]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (type && r.type !== type) return false;
      if (status && r.status !== status) return false;
      if (q) {
        const hay = `${r.code} ${r.fullName} ${r.position}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, type, status]);

  /**
   * The figures above the list, over the list being shown.
   *
   * A staff directory is read to answer "how many of us are there and what
   * does that cost a month", and that was a question this page made somebody
   * add up by hand. The payroll figure counts active people only, because an
   * inactive employee is not paid and including them would overstate what the
   * school owes every month.
   */
  const totals = useMemo(() => {
    const active = filtered.filter((r) => r.status === "ACTIVE");
    return {
      people: filtered.length,
      teachers: filtered.filter((r) => r.type === "TEACHER").length,
      staff: filtered.filter((r) => r.type === "STAFF").length,
      monthly: active.reduce((n, r) => n + r.salary, 0),
      inactive: filtered.length - active.length,
    };
  }, [filtered]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((page - 1) * pageSize, page * pageSize);

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteEmployee(deleting.id);
    if (!res.ok) toast(res.error ?? "Delete failed.", "error");
    else toast(`${deleting.fullName} removed.`, "success");
    setDeleting(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("salaryEmployees.loadingEmployees")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("salaryEmployees.employees")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("salaryEmployees.staffDirectoryDescription")}
          </p>
        </div>
        <Button
          onClick={() => {
            setEditing(null);
            setFormOpen(true);
          }}
        >
          <Plus className="me-2 h-4 w-4" /> {t("salaryEmployeeFormDialog.addEmployee")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="People"
          value={String(totals.people)}
          note={
            totals.inactive
              ? `${totals.inactive} inactive`
              : "All active"
          }
          icon={Users}
          chip="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
        />
        <Kpi
          label={t("salaryEmployees.teachers")}
          value={String(totals.teachers)}
          note="From Teacher Management"
          icon={GraduationCap}
          chip="bg-violet-500/15 text-violet-600 dark:text-violet-400"
        />
        <Kpi
          label={t("salaryEmployees.staff")}
          value={String(totals.staff)}
          note="Guards, cleaners, drivers"
          icon={Wrench}
          chip="bg-sky-500/15 text-sky-600 dark:text-sky-400"
        />
        <Kpi
          label="Monthly payroll"
          value={money(totals.monthly)}
          note="Active people only"
          icon={Banknote}
          chip="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        />
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4 shadow-sm">
        <Input
          placeholder={t("salaryEmployees.searchNameOrEmployeeId")}
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
        <Select
          value={type}
          onChange={(e) => {
            setType(e.target.value as "TEACHER" | "STAFF" | "");
            setPage(1);
          }}
          className="h-9 min-w-[140px]"
        >
          <option value="">{t("salaryEmployees.allTypes")}</option>
          <option value="TEACHER">{t("salaryEmployees.teachers")}</option>
          <option value="STAFF">{t("salaryEmployees.staff")}</option>
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as "ACTIVE" | "INACTIVE" | "");
            setPage(1);
          }}
          className="h-9 min-w-[140px]"
        >
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-secondary/80 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryEmployees.employeeId")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryEmployees.name")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryEmployees.position")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("common.phone")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("salaryEmployeeFormDialog.monthlySalary")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryEmployees.status")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr
                  key={`${r.type}-${r.id}`}
                  className="border-t transition-colors hover:bg-secondary/40"
                >
                  <td className="whitespace-nowrap px-4 py-2.5 font-mono text-xs text-muted-foreground">
                    {r.code}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center gap-3">
                      {/* Initials, so a long list of names has something to
                          land on other than more text. */}
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
                          r.type === "TEACHER"
                            ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                            : "bg-sky-500/15 text-sky-600 dark:text-sky-400",
                        )}
                      >
                        {initials(r.fullName)}
                      </span>
                      <div className="min-w-0">
                        <Link
                          href={
                            r.type === "TEACHER"
                              ? `/teachers/${r.id}`
                              : `/salary/employees/${r.id}`
                          }
                          className="font-medium hover:text-primary hover:underline"
                        >
                          {r.fullName}
                        </Link>
                        <p className="text-xs text-muted-foreground">
                          {r.type === "TEACHER" ? "Teacher" : "Support staff"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
                        positionChip(r.position),
                      )}
                    >
                      {r.position}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-muted-foreground">
                    {r.phone ? (
                      <a href={`tel:${r.phone}`} className="tabular-nums hover:text-primary">
                        {r.phone}
                      </a>
                    ) : (
                      "\u2014"
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-2.5 text-end font-semibold tabular-nums">
                    {money(r.salary)}
                  </td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.status === "ACTIVE" ? "success" : "muted"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={r.type === "TEACHER" ? `/teachers/${r.id}` : `/salary/employees/${r.id}`}
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title={t("common.view")}
                      >
                        <Eye className="h-3.5 w-3.5" />
                      </Link>
                      <Link
                        href={
                          r.type === "TEACHER"
                            ? `/teachers/${r.id}?tab=salary`
                            : `/salary/employees/${r.id}?tab=history`
                        }
                        className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        title={t("salaryEmployees.history")}
                      >
                        <Receipt className="h-3.5 w-3.5" />
                      </Link>
                      {r.employee ? (
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              setEditing(r.employee!);
                              setFormOpen(true);
                            }}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            title={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(r.employee!)}
                            className="flex h-7 w-7 items-center justify-center rounded-lg text-rose-500 transition-colors hover:bg-rose-500/10"
                            title={t("common.delete")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      ) : (
                        // A teacher's record is owned by Teacher Management;
                        // saying so in a full sentence on every row was louder
                        // than the data it sat beside.
                        <span
                          className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground/60"
                          title={t("salaryEmployees.teachersAreSyncedFromTeacherManagement")}
                        >
                          <Lock className="h-3.5 w-3.5" />
                        </span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {pageRows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-muted-foreground">
                    {t("salaryEmployees.noEmployeesFound")}
                  </td>
                </tr>
              )}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="border-t-2 bg-secondary/40 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-3" colSpan={4}>
                    {totals.people} {totals.people === 1 ? "person" : "people"}
                    {totals.inactive > 0 && (
                      <span className="ms-1 font-normal text-muted-foreground">
                        &middot; {totals.inactive} inactive
                      </span>
                    )}
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-end tabular-nums">
                    {money(totals.monthly)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {filtered.length > pageSize && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={pageSize}
              onPageSizeChange={(n) => {
                setPageSize(n);
                setPage(1);
              }}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <EmployeeFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        employee={editing}
      />

      <ConfirmDialog
        open={!!deleting}
        onClose={() => setDeleting(null)}
        onConfirm={handleDelete}
        title={t("salaryEmployees.removeEmployee")}
        message={
          deleting
            ? t("salaryEmployees.removeEmployeeConfirm", { name: deleting.fullName })
            : ""
        }
      />
    </div>
  );
}

/** Up to two initials — enough to recognise a row, never a whole name. */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0]![0]! + (parts[1]?.[0] ?? "")).toUpperCase();
}

/** A colour per kind of job, so the column reads at a glance. */
function positionChip(position: string): string {
  const p = position.toLowerCase();
  if (p.includes("teacher"))
    return "bg-violet-500/10 text-violet-600 dark:text-violet-400";
  if (p.includes("driver"))
    return "bg-amber-500/10 text-amber-600 dark:text-amber-400";
  if (p.includes("clean"))
    return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  if (p.includes("security") || p.includes("guard"))
    return "bg-sky-500/10 text-sky-600 dark:text-sky-400";
  if (p.includes("admin") || p.includes("account") || p.includes("office"))
    return "bg-indigo-500/10 text-indigo-600 dark:text-indigo-400";
  return "bg-secondary text-muted-foreground";
}

/** One figure, said plainly. */
function Kpi({
  label,
  value,
  note,
  icon: Icon,
  chip,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Users;
  chip: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span className={cn("flex h-10 w-10 items-center justify-center rounded-xl", chip)}>
        <Icon className="h-5 w-5" />
      </span>
      <p className="mt-4 text-2xl font-bold leading-none tabular-nums">{value}</p>
      <p className="mt-1.5 truncate text-sm font-medium">{label}</p>
      {note && <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>}
    </div>
  );
}
