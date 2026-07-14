"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Calendar, ChevronRight, FileText, History, Users, Wallet } from "lucide-react";
import { Select } from "@/components/ui/select";
import { SalarySummaryCards } from "@/components/salary/summary-cards";
import { PayrollStatusBadge } from "@/components/salary/status-badge";
import { monthLabel, money, shortDate } from "@/lib/salary/format";
import {
  availableMonths,
  dashboardSummary,
  generatePayroll,
  payrollRows,
  recentPayments,
  useSalaryState,
} from "@/lib/salary/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";

const QUICK = [
  { href: "/salary/payroll", label: "Monthly Payroll", desc: "Generate & pay salaries", icon: Wallet },
  { href: "/salary/employees", label: "Employees", desc: "Salary profiles & setup", icon: Users },
  { href: "/salary/history", label: "Salary History", desc: "All payroll records", icon: History },
  { href: "/salary/reports", label: "Reports", desc: "Payroll analytics", icon: FileText },
];

export default function SalaryDashboardPage() {
  const [mounted, setMounted] = useState(false);
  const state = useSalaryState();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    setFilterMonth(state.activePayrollMonth);
    setFilterYear(state.academicYear);
  }, [mounted, state.activePayrollMonth, state.academicYear]);

  const month = filterMonth || state.activePayrollMonth;
  const summary = useMemo(
    () => (mounted ? dashboardSummary(month) : null),
    [mounted, month, state],
  );
  const pending = useMemo(
    () => (mounted ? payrollRows({ month, status: "PENDING" }).slice(0, 8) : []),
    [mounted, month, state],
  );
  const recent = useMemo(
    () => (mounted ? recentPayments(6) : []),
    [mounted, state],
  );
  const months = useMemo(() => (mounted ? availableMonths() : []), [mounted, state]);

  async function handleGenerate() {
    const res = await generatePayroll(month);
    if (!res.ok) {
      toast(res.error ?? "Could not generate payroll", "error");
      return;
    }
    toast(`Generated ${res.created} payroll records for ${monthLabel(month)}`, "success");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading salary module…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salary Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Payroll overview, salary payments, and employee compensation.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <AcademicYearSelect
              value={filterYear}
              onChange={setFilterYear}
              className="h-8 min-w-[120px] border-0 bg-transparent py-0 shadow-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">Month:</span>
            <Select
              value={month}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-8 min-w-[140px] border-0 bg-transparent py-0 shadow-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
          <Button className="h-9" onClick={handleGenerate}>
            Generate Payroll
          </Button>
        </div>
      </div>

      {summary && <SalarySummaryCards summary={summary} />}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {QUICK.map((q) => (
          <Link
            key={q.href}
            href={q.href}
            className="group rounded-xl border bg-card p-4 shadow-sm transition hover:border-primary/30 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <q.icon className="h-5 w-5" />
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 transition group-hover:opacity-100" />
            </div>
            <p className="mt-3 font-semibold">{q.label}</p>
            <p className="mt-1 text-xs text-muted-foreground">{q.desc}</p>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Pending Salaries</h2>
            <Link href="/salary/payroll" className="text-xs font-medium text-primary hover:underline">
              View all
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Net</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No pending salaries for this month.
                    </td>
                  </tr>
                ) : (
                  pending.map((r) => (
                    <tr key={r.payrollId} className="border-t">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{r.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{r.employeeCode}</p>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums">{money(r.netSalary)}</td>
                      <td className="px-4 py-2.5">
                        <PayrollStatusBadge status={r.status} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border bg-card shadow-sm">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h2 className="font-semibold">Recent Payments</h2>
            <Link href="/salary/history" className="text-xs font-medium text-primary hover:underline">
              View history
            </Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-2 font-medium">Employee</th>
                  <th className="px-4 py-2 font-medium">Amount</th>
                  <th className="px-4 py-2 font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {recent.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="px-4 py-8 text-center text-muted-foreground">
                      No payments recorded yet.
                    </td>
                  </tr>
                ) : (
                  recent.map((p) => (
                    <tr key={p.id} className="border-t">
                      <td className="px-4 py-2.5">
                        <p className="font-medium">{p.employeeName}</p>
                        <p className="text-xs text-muted-foreground">{p.month}</p>
                      </td>
                      <td className="px-4 py-2.5 tabular-nums font-medium text-emerald-600">
                        {money(p.amount)}
                      </td>
                      <td className="px-4 py-2.5 text-muted-foreground">
                        {shortDate(p.paidAt)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
