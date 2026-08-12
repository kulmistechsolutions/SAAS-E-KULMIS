"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Pencil, Plus, Trash2 } from "lucide-react";
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

const PAGE_SIZE = 15;

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
  const [mounted, setMounted] = useState(false);
  const teachersState = useTeachersState();
  const employeesState = useEmployeesState();
  const [search, setSearch] = useState("");
  const [type, setType] = useState<"TEACHER" | "STAFF" | "">("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StaffEmployee | null>(null);
  const [deleting, setDeleting] = useState<StaffEmployee | null>(null);

  useEffect(() => setMounted(true), []);

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
      if (q) {
        const hay = `${r.code} ${r.fullName} ${r.position}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rows, search, type]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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

      <div className="flex flex-wrap gap-3">
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
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.employeeId")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.name")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.position")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.phone")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployeeFormDialog.monthlySalary")}</th>
                <th className="px-4 py-2.5 font-medium">{t("salaryEmployees.status")}</th>
                <th className="px-4 py-2.5 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={`${r.type}-${r.id}`} className="border-t">
                  <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2.5 font-medium">
                    {r.type === "TEACHER" ? (
                      <Link href={`/teachers/${r.id}`} className="text-primary hover:underline">
                        {r.fullName}
                      </Link>
                    ) : (
                      r.fullName
                    )}
                  </td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.position}</td>
                  <td className="px-4 py-2.5 text-muted-foreground">{r.phone ?? "—"}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.salary)}</td>
                  <td className="px-4 py-2.5">
                    <Badge tone={r.status === "ACTIVE" ? "success" : "muted"}>{r.status}</Badge>
                  </td>
                  <td className="px-4 py-2.5">
                    {r.employee ? (
                      <div className="flex items-center gap-1">
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
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {t("salaryEmployees.teachersAreSyncedFromTeacherManagement")}
                      </span>
                    )}
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
          </table>
        </div>
        {filtered.length > PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={filtered.length}
              pageSize={PAGE_SIZE}
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
