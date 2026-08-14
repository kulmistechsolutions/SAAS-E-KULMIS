"use client";

import { Suspense, use, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Eye, Pencil, Printer, Receipt, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs } from "@/components/ui/tabs";
import { EmployeeFormDialog } from "@/components/salary/employee-form-dialog";
import { PayslipDialog } from "@/components/salary/payslip-dialog";
import { PayrollStatusBadge } from "@/components/salary/status-badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { useEmployeesState, deleteEmployee } from "@/lib/employees/store";
import { employeePayrollHistory, getEmployee } from "@/lib/salary/store";
import { money, monthLabel } from "@/lib/salary/format";
import { printPayslip } from "@/lib/salary/print";
import type { PayrollRecord } from "@/lib/salary/types";
import { toast } from "@/lib/toast";

const TAB_LIST = [
  { id: "overview", label: "Overview", icon: <User className="h-4 w-4" /> },
  { id: "history", label: "History", icon: <Receipt className="h-4 w-4" /> },
];

export default function EmployeeProfilePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading profile…
        </div>
      }
    >
      <EmployeeProfileContent id={id} />
    </Suspense>
  );
}

function EmployeeProfileContent({ id }: { id: string }) {
  const router = useRouter();
  const search = useSearchParams();
  const state = useEmployeesState();
  const employee = useMemo(() => state.employees.find((e) => e.id === id), [state, id]);

  const [tab, setTab] = useState(search.get("tab") ?? "overview");
  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const payrollRows = useMemo(() => {
    const emp = employee ? getEmployee(employee.id) : undefined;
    if (!emp) return [];
    return employeePayrollHistory(emp.id);
  }, [employee]);

  const [payslip, setPayslip] = useState<PayrollRecord | null>(null);

  if (!employee) {
    return (
      <div className="space-y-4">
        <Link
          href="/salary/employees"
          className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Employees
        </Link>
        <div className="rounded-2xl border bg-card p-12 text-center text-muted-foreground">
          Employee not found
        </div>
      </div>
    );
  }

  async function handleDelete() {
    setDeleting(true);
    const res = await deleteEmployee(employee!.id);
    setDeleting(false);
    setDeleteOpen(false);
    if (!res.ok) {
      toast(res.error ?? "Delete failed.", "error");
      return;
    }
    toast(`${employee!.fullName} removed.`, "success");
    router.push("/salary/employees");
  }

  return (
    <div className="space-y-6">
      <Link
        href="/salary/employees"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to Employees
      </Link>

      <div className="flex flex-col gap-4 rounded-2xl border bg-card p-6 shadow-sm sm:flex-row sm:items-center">
        <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-2xl font-bold text-white">
          {employee.fullName.charAt(0)}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold">{employee.fullName}</h1>
            <Badge tone={employee.status === "ACTIVE" ? "success" : "muted"} dot>
              {employee.status}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            <span className="font-mono">{employee.code}</span> · {employee.position} · {money(employee.salary)}/mo
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setEditOpen(true)}>
            <Pencil className="me-2 h-4 w-4" /> Edit
          </Button>
          <Button
            variant="outline"
            className="text-rose-600 hover:bg-rose-500/10"
            onClick={() => setDeleteOpen(true)}
          >
            <Trash2 className="me-2 h-4 w-4" /> Delete
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card shadow-sm">
        <Tabs tabs={TAB_LIST} active={tab} onChange={setTab} className="px-2" />
        <div className="p-6">
          {tab === "overview" && (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <Field label="Employee ID" value={<span className="font-mono">{employee.code}</span>} />
              <Field label="Full Name" value={employee.fullName} />
              <Field label="Position" value={employee.position} />
              <Field label="Phone" value={employee.phone ?? "—"} />
              <Field label="Monthly Salary" value={money(employee.salary)} />
              <Field label="Status" value={employee.status} />
              {employee.notes && (
                <Field label="Notes" value={employee.notes} />
              )}
            </div>
          )}

          {tab === "history" && (
            <div className="overflow-hidden rounded-xl border">
              <table className="w-full text-sm">
                <thead className="bg-secondary text-start text-xs text-muted-foreground">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Month</th>
                    <th className="px-4 py-2.5 font-medium">Net Salary</th>
                    <th className="px-4 py-2.5 font-medium">Paid</th>
                    <th className="px-4 py-2.5 font-medium">Balance</th>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-muted-foreground">
                        No payroll records yet
                      </td>
                    </tr>
                  ) : (
                    payrollRows.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="px-4 py-2.5">{monthLabel(r.payrollMonth)}</td>
                        <td className="px-4 py-2.5 tabular-nums">{money(r.netSalary)}</td>
                        <td className="px-4 py-2.5 tabular-nums text-emerald-600">
                          {money(r.amountPaid)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums">{money(r.remainingBalance)}</td>
                        <td className="px-4 py-2.5">
                          <PayrollStatusBadge status={r.status} />
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex gap-1">
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => setPayslip(r)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0"
                              onClick={() => printPayslip(r)}
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <EmployeeFormDialog open={editOpen} onClose={() => setEditOpen(false)} employee={employee} />
      <PayslipDialog payroll={payslip} onClose={() => setPayslip(null)} />
      <ConfirmDialog
        open={deleteOpen}
        onClose={() => setDeleteOpen(false)}
        onConfirm={handleDelete}
        title="Remove Employee"
        message={`Are you sure you want to remove ${employee.fullName}? This cannot be undone.${deleting ? " Removing…" : ""}`}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl border bg-secondary/30 px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-0.5 font-medium">{value}</p>
    </div>
  );
}
