import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import {
  money,
  monthLabel,
  paymentMethodLabel,
  payrollStatusLabel,
  shortDate,
} from "./format";
import { getEmployee, getPayroll, paymentsForPayroll } from "./store";
import type { PayrollRecord, SalaryPayment } from "./types";

export function payslipHtml(
  payroll: PayrollRecord,
  payment?: SalaryPayment | null,
): string {
  const emp = getEmployee(payroll.employeeId);
  const lastPayment =
    payment ?? paymentsForPayroll(payroll.id)[0] ?? null;
  const { payslipHeader, payslipFooter } = getSettings().salary;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>Payslip — ${emp?.fullName ?? "Employee"}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:760px;margin:0 auto}
  ${PRINT_HEADER_CSS}
  .badge{display:inline-block;padding:4px 10px;border-radius:999px;font-size:12px;font-weight:600;background:#e0e7ff;color:#3730a3}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:42%;color:#64748b;font-weight:500}
  .net{font-size:28px;font-weight:700;color:#16a34a;text-align:center;margin:24px 0}
  .sign{display:grid;grid-template-columns:1fr 1fr;gap:40px;margin-top:48px}
  .sign div{border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
  ${printHeaderHtml(
    payslipHeader || "Salary Payslip",
    `<span class="badge">${payrollStatusLabel(payroll.status)}</span><div class="ek-tagline" style="margin-top:8px">${monthLabel(payroll.payrollMonth)}</div>`,
  )}
  <table>
    <tr><th>Employee Name</th><td>${emp?.fullName ?? "—"}</td></tr>
    <tr><th>Employee ID</th><td>${emp?.code ?? "—"}</td></tr>
    <tr><th>Position</th><td>${emp?.position ?? "—"}</td></tr>
    <tr><th>Payroll Month</th><td>${monthLabel(payroll.payrollMonth)}</td></tr>
    <tr><th>Basic Salary</th><td>${money(payroll.basicSalary)}</td></tr>
    <tr><th>Allowances</th><td>${money(payroll.allowances)}</td></tr>
    <tr><th>Bonus</th><td>${money(payroll.bonus)}</td></tr>
    <tr><th>Deductions</th><td>−${money(payroll.deductions)}</td></tr>
    <tr><th>Net Salary</th><td><strong>${money(payroll.netSalary)}</strong></td></tr>
    <tr><th>Amount Paid</th><td>${money(payroll.amountPaid)}</td></tr>
    <tr><th>Remaining Balance</th><td>${money(payroll.remainingBalance)}</td></tr>
    ${
      lastPayment
        ? `<tr><th>Payment Method</th><td>${paymentMethodLabel(lastPayment.paymentMethod)}</td></tr>
    <tr><th>Payment Date</th><td>${shortDate(lastPayment.paidAt)}</td></tr>
    <tr><th>Prepared By</th><td>${lastPayment.paidBy}</td></tr>`
        : ""
    }
  </table>
  <div class="net">Net Salary: ${money(payroll.netSalary)}</div>
  <div class="sign">
    <div>Employee Signature</div>
    <div>Authorized Signature</div>
  </div>
  <div class="foot">${payslipFooter || "This is a computer-generated payslip."}</div>
</body></html>`;
}

export function printPayslip(payroll: PayrollRecord, payment?: SalaryPayment | null) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(payslipHtml(payroll, payment));
  w.document.close();
  w.focus();
  w.print();
}

export function downloadPayslipPdf(payroll: PayrollRecord, payment?: SalaryPayment | null) {
  printPayslip(payroll, payment);
}

export function exportPayrollReportCsv(
  rows: {
    employeeCode: string;
    employeeName: string;
    position: string;
    payrollMonth: string;
    netSalary: number;
    amountPaid: number;
    remainingBalance: number;
    status: string;
  }[],
  filename = "salary-report.csv",
) {
  const header =
    "Employee ID,Name,Position,Month,Net Salary,Paid,Balance,Status\n";
  const body = rows
    .map((r) =>
      [
        r.employeeCode,
        `"${r.employeeName}"`,
        r.position,
        r.payrollMonth,
        r.netSalary,
        r.amountPaid,
        r.remainingBalance,
        r.status,
      ].join(","),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
