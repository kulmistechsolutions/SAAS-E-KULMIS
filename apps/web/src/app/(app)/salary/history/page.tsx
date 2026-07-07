"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { PayslipDialog } from "@/components/salary/payslip-dialog";
import { PayrollStatusBadge } from "@/components/salary/status-badge";
import {
  monthLabel,
  money,
  POSITIONS,
  payrollStatusLabel,
  shortDate,
} from "@/lib/salary/format";
import { exportPayrollReportCsv, printPayslip } from "@/lib/salary/print";
import {
  availableMonths,
  getEmployee,
  getPayroll,
  useSalaryState,
} from "@/lib/salary/store";
import type { PayrollStatus } from "@/lib/salary/types";

const PAGE_SIZE = 20;

export default function SalaryHistoryPage() {
  const [mounted, setMounted] = useState(false);
  const state = useSalaryState();
  const [search, setSearch] = useState("");
  const [month, setMonth] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<PayrollStatus | "">("");
  const [page, setPage] = useState(1);
  const [payslipId, setPayslipId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const months = useMemo(() => (mounted ? availableMonths() : []), [mounted, state]);

  const rows = useMemo(() => {
    if (!mounted) return [];
    const q = search.trim().toLowerCase();
    return state.payroll
      .filter((p) => {
        if (month && p.payrollMonth !== month) return false;
        if (status && p.status !== status) return false;
        const emp = getEmployee(p.employeeId);
        if (position && emp?.position !== position) return false;
        if (q) {
          const hay = `${emp?.code ?? ""} ${emp?.fullName ?? ""}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => b.payrollMonth.localeCompare(a.payrollMonth))
      .map((p) => {
        const emp = getEmployee(p.employeeId);
        return { ...p, emp };
      });
  }, [mounted, state.payroll, month, status, position, search]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const payslip = payslipId ? getPayroll(payslipId) ?? null : null;

  const exportRows = rows.map((r) => ({
    employeeCode: r.emp?.code ?? "",
    employeeName: r.emp?.fullName ?? "",
    position: r.emp?.position ?? "",
    payrollMonth: r.payrollMonth,
    netSalary: r.netSalary,
    amountPaid: r.amountPaid,
    remainingBalance: r.remainingBalance,
    status: r.status,
  }));

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading history…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Salary History</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete payroll records with payslip access.
          </p>
        </div>
        <Button
          variant="outline"
          className="h-9"
          onClick={() => exportPayrollReportCsv(exportRows, "salary-history.csv")}
        >
          <Download className="mr-2 h-4 w-4" />
          Export CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input
          placeholder="Search employee…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
        <Select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[160px]"
        >
          <option value="">All months</option>
          {months.map((m) => (
            <option key={m} value={m}>
              {monthLabel(m)}
            </option>
          ))}
        </Select>
        <Select
          value={position}
          onChange={(e) => {
            setPosition(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[160px]"
        >
          <option value="">All positions</option>
          {POSITIONS.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </Select>
        <Select
          value={status}
          onChange={(e) => {
            setStatus(e.target.value as PayrollStatus | "");
            setPage(1);
          }}
          className="h-9 min-w-[140px]"
        >
          <option value="">All statuses</option>
          {(["PENDING", "PARTIAL", "PAID"] as PayrollStatus[]).map((s) => (
            <option key={s} value={s}>
              {payrollStatusLabel(s)}
            </option>
          ))}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1100px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Month</th>
                <th className="px-4 py-2.5 font-medium">Basic</th>
                <th className="px-4 py-2.5 font-medium">Allowances</th>
                <th className="px-4 py-2.5 font-medium">Bonus</th>
                <th className="px-4 py-2.5 font-medium">Deductions</th>
                <th className="px-4 py-2.5 font-medium">Net</th>
                <th className="px-4 py-2.5 font-medium">Paid</th>
                <th className="px-4 py-2.5 font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="px-4 py-2.5">
                    <p className="font-medium">{r.emp?.fullName ?? "—"}</p>
                    <p className="text-xs text-muted-foreground">{r.emp?.code}</p>
                  </td>
                  <td className="px-4 py-2.5">{monthLabel(r.payrollMonth)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.basicSalary)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.allowances)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.bonus)}</td>
                  <td className="px-4 py-2.5 tabular-nums">{money(r.deductions)}</td>
                  <td className="px-4 py-2.5 tabular-nums font-medium">{money(r.netSalary)}</td>
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
                        onClick={() => setPayslipId(r.id)}
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
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={rows.length}
              pageSize={PAGE_SIZE}
              onPageChange={setPage}
            />
          </div>
        )}
      </div>

      <PayslipDialog payroll={payslip} onClose={() => setPayslipId(null)} />
    </div>
  );
}
