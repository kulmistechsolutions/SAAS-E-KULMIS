"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import {
  Banknote,
  CheckCircle2,
  Download,
  Eye,
  Printer,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Can } from "@/components/auth/can";
import { Dialog } from "@/components/ui/dialog";
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
import {
  exportPayrollReportCsv,
  printPayrollReport,
} from "@/lib/salary/print";
import {
  availableMonths,
  generatePayroll,
  getPayroll,
  payrollRows,
  removePayroll,
  useSalaryState,
} from "@/lib/salary/store";
import type { PayrollRow, PayrollStatus } from "@/lib/salary/types";
import { ensureEmployeesLoaded } from "@/lib/employees/store";
import { refreshTeachers } from "@/lib/teachers/store";
import { toast } from "@/lib/toast";
import { printPayslip } from "@/lib/salary/print";
import { useHydrated } from "@/lib/use-hydrated";

const STATUSES: (PayrollStatus | "")[] = ["", "PENDING", "PARTIAL", "PAID"];

export default function PayrollPage() {
  const t = useT();
  const mounted = useHydrated();
  const state = useSalaryState();
  const [month, setMonth] = useState("");
  const [search, setSearch] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<PayrollStatus | "">("");
  const [page, setPage] = useState(1);
  // How many rows at once. A list of thirteen pages is thirteen clicks
  // to read, and reading all of it is usually why it was opened.
  const [pageSize, setPageSize] = useState(15);
  const [payRow, setPayRow] = useState<PayrollRow | null>(null);
  const [payslipId, setPayslipId] = useState<string | null>(null);
  const [removeRow, setRemoveRow] = useState<PayrollRow | null>(null);
  const [removing, setRemoving] = useState(false);

  useEffect(() => {
    if (mounted) setMonth(state.activePayrollMonth);
  }, [mounted, state.activePayrollMonth]);

  // A salary row knows only which teacher or employee it belongs to. Their
  // staff number lives on those records, so without this the list falls back
  // to showing a database key under every name.
  useEffect(() => {
    void refreshTeachers();
    void ensureEmployeesLoaded();
  }, []);

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

  /**
   * Totalled from the rows on screen, never from the whole month.
   *
   * The figures and the printed report are the same arithmetic over the same
   * list, so filtering to one position and printing it gives a document whose
   * total is that position's — not the school's, which would be a wrong
   * document with a stamp on it.
   */
  const totals = useMemo(
    () => ({
      count: rows.length,
      net: rows.reduce((n, r) => n + r.netSalary, 0),
      paid: rows.reduce((n, r) => n + r.amountPaid, 0),
      due: rows.reduce((n, r) => n + r.remainingBalance, 0),
      settled: rows.filter((r) => r.status === "PAID").length,
    }),
    [rows],
  );

  const reportScope = [
    { label: "Payroll Month", value: month ? monthLabel(month) : "" },
    { label: "Position", value: position || "All positions" },
    {
      label: "Status",
      value: status ? payrollStatusLabel(status as PayrollStatus) : "All statuses",
    },
    { label: "Search", value: search.trim() },
  ];

  const pageCount = Math.max(1, Math.ceil(rows.length / pageSize));
  const pageRows = rows.slice((page - 1) * pageSize, page * pageSize);
  const payslip = payslipId ? getPayroll(payslipId) ?? null : null;

  async function handleGenerate() {
    const res = await generatePayroll(month);
    if (!res.ok) {
      toast(res.error ?? "Could not generate payroll", "error");
      return;
    }
    toast(`Generated ${res.created} records`, "success");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("salaryPayroll.loadingPayroll")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("salaryPayroll.monthlyPayroll")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("salaryPayroll.generatePayrollAndProcessFullOr")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={handleGenerate}>
            {t("salaryPayroll.generatePayroll")}
          </Button>
          {/* Print All prints exactly what the filters left on screen. */}
          <Button
            className="h-9"
            onClick={() => {
              if (rows.length === 0)
                return toast("No payroll records to print.", "error");
              printPayrollReport({ scope: reportScope, rows });
            }}
          >
            <Printer className="me-2 h-4 w-4" /> Print All
          </Button>
          <Button
            variant="outline"
            className="h-9"
            onClick={() => exportPayrollReportCsv(rows, `payroll-${month}.csv`)}
          >
            <Download className="me-2 h-4 w-4" />
            {t("salaryPayroll.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Kpi
          label="Employees"
          value={String(totals.count)}
          note={`${totals.settled} fully paid`}
          icon={Users}
          chip="bg-indigo-500/15 text-indigo-600 dark:text-indigo-400"
        />
        <Kpi
          label="Total Payroll"
          value={money(totals.net)}
          note={month ? monthLabel(month) : ""}
          icon={Banknote}
          chip="bg-sky-500/15 text-sky-600 dark:text-sky-400"
        />
        <Kpi
          label="Paid"
          value={money(totals.paid)}
          note="Already settled"
          icon={CheckCircle2}
          chip="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
        />
        <Kpi
          label="Outstanding"
          value={money(totals.due)}
          note="Still owed to staff"
          icon={Wallet}
          chip="bg-rose-500/15 text-rose-600 dark:text-rose-400"
          danger={totals.due > 0}
        />
      </div>

      <div className="flex flex-wrap gap-3 rounded-2xl border bg-card p-4 shadow-sm">
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
          <option value="">{t("salaryPayroll.allPositions")}</option>
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
          <option value="">{t("salaryPayroll.allStatuses")}</option>
          {STATUSES.filter(Boolean).map((s) => (
            <option key={s} value={s}>
              {payrollStatusLabel(s as PayrollStatus)}
            </option>
          ))}
        </Select>
        <Input
          placeholder={t("salaryPayroll.searchEmployeeNameOrId")}
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
            <thead className="sticky top-0 bg-secondary/80 text-xs uppercase tracking-wide text-muted-foreground backdrop-blur">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryPayroll.employee")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryPayroll.position")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("salaryPayroll.netSalary")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("salaryPayroll.paid")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("salaryPayroll.balance")}</th>
                <th className="px-4 py-2.5 text-start font-medium">{t("salaryPayroll.status")}</th>
                <th className="px-4 py-2.5 text-end font-medium">{t("salaryPayroll.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-muted-foreground">
                    {t("salaryPayroll.noPayrollRecordsForThisFilter")}
                  </td>
                </tr>
              ) : (
                pageRows.map((r) => (
                  <tr key={r.payrollId} className="border-t transition-colors hover:bg-secondary/40">
                    <td className="px-4 py-2.5">
                      <p className="font-medium">{r.employeeName}</p>
                      {r.employeeCode && (
                        <p className="font-mono text-xs text-muted-foreground">
                          {r.employeeCode}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{r.position}</td>
                    <td className="px-4 py-2.5 text-end font-medium tabular-nums">
                      {money(r.netSalary)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-emerald-600">
                      {money(r.amountPaid)}
                    </td>
                    <td className="px-4 py-2.5 text-end tabular-nums text-rose-600">
                      {r.remainingBalance > 0 ? money(r.remainingBalance) : "\u2014"}
                    </td>
                    <td className="px-4 py-2.5">
                      <PayrollStatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-2.5">
                      <div className="flex justify-end gap-1">
                        {r.status !== "PAID" && (
                          <Button
                            variant="outline"
                            className="h-8 px-2"
                            onClick={() => setPayRow(r)}
                          >
                            <Wallet className="me-1 h-3.5 w-3.5" />
                            {t("salaryPayroll.pay")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="View payslip"
                          onClick={() => setPayslipId(r.payrollId)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          title="Print this payslip"
                          onClick={() => {
                            const p = getPayroll(r.payrollId);
                            if (p) printPayslip(p);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        {/*
                          Only where nothing has been paid. A settled row is an
                          account of money that left the school; that is undone
                          by reversing the payment, which keeps the trail.
                        */}
                        {r.amountPaid === 0 && (
                          <Can perform="salaries.delete">
                            <Button
                              variant="ghost"
                              className="h-8 w-8 p-0 text-rose-600 hover:text-rose-700"
                              title={t("salaryPayroll.removeRow")}
                              onClick={() => setRemoveRow(r)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </Can>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {pageRows.length > 0 && (
              <tfoot className="border-t-2 bg-secondary/40 text-sm font-semibold">
                <tr>
                  <td className="px-4 py-3" colSpan={2}>
                    Total &middot; {totals.count}{" "}
                    {totals.count === 1 ? "employee" : "employees"}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {money(totals.net)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-emerald-600">
                    {money(totals.paid)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-rose-600">
                    {money(totals.due)}
                  </td>
                  <td colSpan={2} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        {rows.length > pageSize && (
          <div className="border-t px-4 py-3">
            <Pagination
              page={page}
              pageCount={pageCount}
              total={rows.length}
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

      <SalaryPaymentDialog
        open={!!payRow}
        row={payRow}
        onClose={() => setPayRow(null)}
      />
      <PayslipDialog payroll={payslip} onClose={() => setPayslipId(null)} />

      <Dialog
        open={!!removeRow}
        onClose={() => setRemoveRow(null)}
        title={t("salaryPayroll.removeRow")}
        className="max-w-md"
        footer={
          <>
            <Button variant="outline" onClick={() => setRemoveRow(null)}>
              {t("common.cancel")}
            </Button>
            <Button
              variant="destructive"
              disabled={removing}
              onClick={async () => {
                if (!removeRow) return;
                setRemoving(true);
                const res = await removePayroll(removeRow);
                setRemoving(false);
                if (res.ok) {
                  toast(
                    `${removeRow.employeeName} — ${monthLabel(removeRow.payrollMonth)}`,
                    "success",
                  );
                  setRemoveRow(null);
                } else {
                  toast(res.error ?? "Failed.", "error");
                }
              }}
            >
              {removing ? t("common.saving") : t("common.delete")}
            </Button>
          </>
        }
      >
        {removeRow && (
          <div className="space-y-3 text-sm">
            <p>
              {t("salaryPayroll.removeRowBody")
                .replace("{name}", removeRow.employeeName)
                .replace("{month}", monthLabel(removeRow.payrollMonth))}
            </p>
            <div className="rounded-lg border bg-secondary/40 px-3 py-2">
              <p className="font-medium">{removeRow.employeeName}</p>
              <p className="text-xs text-muted-foreground">
                {removeRow.employeeCode} &middot; {money(removeRow.netSalary)}{" "}
                &middot; {payrollStatusLabel(removeRow.status)}
              </p>
            </div>
            <p className="text-xs text-muted-foreground">
              {t("salaryPayroll.removeRowSafe")}
            </p>
          </div>
        )}
      </Dialog>
    </div>
  );
}

/** One figure, said plainly. */
function Kpi({
  label,
  value,
  note,
  icon: Icon,
  chip,
  danger,
}: {
  label: string;
  value: string;
  note: string;
  icon: typeof Wallet;
  chip: string;
  danger?: boolean;
}) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-sm">
      <span
        className={`flex h-10 w-10 items-center justify-center rounded-xl ${chip}`}
      >
        <Icon className="h-5 w-5" />
      </span>
      <p
        className={`mt-4 text-2xl font-bold leading-none tabular-nums ${
          danger ? "text-rose-600 dark:text-rose-400" : ""
        }`}
      >
        {value}
      </p>
      <p className="mt-1.5 truncate text-sm font-medium">{label}</p>
      {note && (
        <p className="mt-0.5 truncate text-xs text-muted-foreground">{note}</p>
      )}
    </div>
  );
}
