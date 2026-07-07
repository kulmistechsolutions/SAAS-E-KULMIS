"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Printer, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { SalaryPaymentDialog } from "@/components/salary/payment-dialog";
import { PayslipDialog } from "@/components/salary/payslip-dialog";
import { PayrollStatusBadge } from "@/components/salary/status-badge";
import {
  monthLabel,
  money,
  POSITIONS,
  payrollStatusLabel,
} from "@/lib/salary/format";
import { exportPayrollReportCsv } from "@/lib/salary/print";
import {
  availableMonths,
  generatePayroll,
  getPayroll,
  payrollRows,
  useSalaryState,
} from "@/lib/salary/store";
import type { PayrollRow, PayrollStatus } from "@/lib/salary/types";
import { toast } from "@/lib/toast";
import { printPayslip } from "@/lib/salary/print";

const PAGE_SIZE = 15;
const STATUSES: (PayrollStatus | "")[] = ["", "PENDING", "PARTIAL", "PAID"];

export default function PayrollPage() {
  const [mounted, setMounted] = useState(false);
  const state = useSalaryState();
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<PayrollStatus | "">("");
  const [page, setPage] = useState(1);
  const [payRow, setPayRow] = useState<PayrollRow | null>(null);
  const [payslipId, setPayslipId] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (mounted) setMonth(state.activePayrollMonth);
  }, [mounted, state.activePayrollMonth]);

  const months = useMemo(() => (mounted ? availableMonths() : []), [mounted, state]);
  const rows = useMemo(
    () =>
      mounted
        ? payrollRows({
            month,
            search,
            position: position || undefined,
            status: status || undefined,
          })
        : [],
    [mounted, month, search, position, status, state],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const payslip = payslipId ? getPayroll(payslipId) ?? null : null;

  function handleGenerate() {
    const res = generatePayroll(month);
    if (!res.ok) {
      toast(res.error ?? "Could not generate payroll", "error");
      return;
    }
    toast(`Generated ${res.created} records`, "success");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading payroll…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Monthly Payroll</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate payroll and process full or partial salary payments.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={handleGenerate}>
            Generate Payroll
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => exportPayrollReportCsv(rows, `payroll-${month}.csv`)}
          >
            <Download className="mr-2 h-4 w-4" />
            Export CSV
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select
          value={month}
          onChange={(e) => {
            setMonth(e.target.value);
            setPage(1);
          }}
          className="h-9 min-w-[160px]"
        >
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
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {payrollStatusLabel(s as PayrollStatus)}
            </option>
          ))}
        </Select>
        <Input
          placeholder="Search employee name or ID…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="h-9 max-w-xs"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">Employee</th>
                <th className="px-4 py-2.5 font-medium">Position</th>
                <th className="px-4 py-2.5 font-medium">Net Salary</th>
                <th className="px-4 py-2.5 font-medium">Paid</th>
                <th className="px-4 py-2.5 font-medium">Balance</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    No payroll records for this filter.
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.payrollId} className="border-t">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.employeeName}</p>
                      <p className="text-xs text-muted-foreground">{r.employeeCode}</p>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.position}</td>
                    <td className="px-4 py-2.5 tabular-nums">{money(r.netSalary)}</td>
                    <td className="px-4 py-2.5 tabular-nums text-emerald-600">
                      {money(r.amountPaid)}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-rose-600">
                      {money(r.remainingBalance)}
                    </td>
                    <td className="px-4 py-2.5">
                      <PayrollStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        {r.status !== "PAID" && (
                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => setPayRow(r)}
                          >
                            <Wallet className="mr-1 h-3.5 w-3.5" />
                            Pay
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => setPayslipId(r.payrollId)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => {
                            const p = getPayroll(r.payrollId);
                            if (p) printPayslip(p);
                          }}
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

      <SalaryPaymentDialog
        open={!!payRow}
        row={payRow}
        onClose={() => setPayRow(null)}
      />
      <PayslipDialog payroll={payslip} onClose={() => setPayslipId(null)} />
    </div>
  );
}
