"use client";

import {
  LETTERHEAD_CSS,
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  signatureHtml,
  stampHtml,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { paperCss, type PaperSize } from "@/lib/print/paper";
import { designFor } from "@/lib/print/design-store";
import { getSettings, schoolBranding } from "@/lib/settings/store";
import {
  money,
  monthLabel,
  paymentMethodLabel,
  payrollStatusLabel,
  shortDate,
} from "./format";
import { getEmployee, paymentsForPayroll, staffCode } from "./store";
import type { PayrollRecord, PayrollRow, SalaryPayment } from "./types";

/**
 * Salary documents, on school paper.
 *
 * A payslip is the one document a member of staff takes to a bank or a
 * landlord, and this one was a bare two-column table under a compact header —
 * it did not look like it came from the school, because it did not use the
 * school's letterhead. Both documents here now go through the same engine and
 * the same Settings → Print & Document Designs entry as receipts and result
 * cards, so a school sets its paper once.
 */

function escapeHtml(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function design(id: string): { paper: PaperSize; landscape: boolean } {
  const d = designFor(id);
  return { paper: d.paper ?? "A4", landscape: d.landscape ?? false };
}

const SHARED_CSS = `
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;
    -webkit-print-color-adjust:exact;print-color-adjust:exact}

  .sec{margin-top:12px}
  .sec-head{background:var(--ek-accent);color:#fff;padding:6px 12px;font-size:11px;
    font-weight:800;text-transform:uppercase;letter-spacing:.06em}
  .card{border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
  table.kv{width:100%;border-collapse:collapse}
  table.kv td{padding:5px 12px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
  table.kv td.k{color:#64748b;width:38%}
  table.kv td.v{font-weight:600}
  table.kv td.num{text-align:end;font-variant-numeric:tabular-nums}
  table.kv tr:last-child td{border-bottom:none}
  table.kv tr.total td{background:#f8fafc;font-size:13px;font-weight:800}

  .stats{display:flex;gap:10px;margin-top:12px}
  .stat{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px 12px}
  .stat-l{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .stat-v{font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}

  table.list{width:100%;border-collapse:collapse;margin-top:12px}
  table.list th{background:#f8fafc;color:#475569;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.04em;padding:7px 10px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.list td{padding:6px 10px;font-size:11.5px;border-bottom:1px solid #f1f5f9}
  table.list td.n{width:30px;color:#94a3b8}
  table.list .num{text-align:end;font-variant-numeric:tabular-nums}
  table.list .mono{font-family:ui-monospace,monospace;font-size:10.5px}
  table.list tfoot td{background:#f8fafc;font-weight:800;font-size:12px;
    border-top:1.5px solid #cbd5e1}
  table.list td.empty{padding:28px;text-align:center;color:#64748b}

  /* A long payroll keeps its headings on every sheet and never splits a
     person's row across a page break. */
  thead{display:table-header-group}
  tr{break-inside:avoid;page-break-inside:avoid}

  .foot-band{margin-top:26px;display:flex;align-items:flex-end;
    justify-content:space-between;gap:16px}
  .note{margin-top:14px;font-size:10.5px;color:#64748b;text-align:center}

  @media print{ .doc-watermark{position:absolute} }
`;

function shell(opts: {
  title: string;
  subtitle?: string;
  refLabel?: string;
  refValue?: string;
  paper: PaperSize;
  landscape: boolean;
  leftSignature: string;
  body: string;
}): string {
  const s = schoolBranding();
  return `<!DOCTYPE html>
<html lang="en"><head><meta charset="utf-8"/><title>${escapeHtml(opts.title)}</title>
<style>
  ${SHARED_CSS}
  ${paperCss(opts.paper)}
  ${
    opts.landscape
      ? "@page{size:" +
        (opts.paper === "A5" ? "A5" : opts.paper === "LETTER" ? "letter" : "A4") +
        " landscape}body{max-width:none}"
      : ""
  }
  ${LETTERHEAD_CSS}
</style></head>
<body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({
    title: opts.title,
    subtitle: opts.subtitle,
    refLabel: opts.refLabel,
    refValue: opts.refValue,
  })}

  ${opts.body}

  <div class="foot-band">
    ${signatureHtml(opts.leftSignature)}
    ${stampHtml(s.name.trim().slice(0, 18), "OFFICIAL")}
    ${signatureHtml("Principal")}
  </div>

  ${documentFooterHtml()}
</div>
</body></html>`;
}

// ── One person's payslip ────────────────────────────────────────────────

export interface PayslipPerson {
  fullName: string;
  position: string;
  code: string;
}

export function payslipHtml(
  payroll: PayrollRecord,
  payment?: SalaryPayment | null,
  /** Supplied only by the Settings preview, which has no salary store. */
  person?: PayslipPerson,
  paperOverride?: PaperSize,
): string {
  const emp = person ? null : getEmployee(payroll.employeeId);
  const lastPayment = payment ?? paymentsForPayroll(payroll.id)[0] ?? null;
  const { payslipFooter } = getSettings().salary;
  const d = design("SALARY_PAYSLIP");
  const code = person ? person.code : emp ? staffCode(emp.id, emp.teacherId) : "";

  const who = [
    { k: "Employee Name", v: person?.fullName ?? emp?.fullName ?? "—" },
    { k: "Staff ID", v: code },
    { k: "Position", v: person?.position ?? emp?.position ?? "—" },
    { k: "Payroll Month", v: monthLabel(payroll.payrollMonth) },
    { k: "Status", v: payrollStatusLabel(payroll.status) },
  ]
    .filter((x) => x.v && x.v !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.k)}</td><td class="v">${escapeHtml(x.v)}</td></tr>`,
    )
    .join("");

  // Earnings and deductions as they were computed, then the net — a payslip
  // that shows only a net figure is a payslip nobody can check.
  const lines = [
    { k: "Basic Salary", v: money(payroll.basicSalary) },
    { k: "Allowances", v: money(payroll.allowances) },
    { k: "Bonus", v: money(payroll.bonus) },
    { k: "Deductions", v: `−${money(payroll.deductions)}` },
  ]
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.k)}</td><td class="v num">${escapeHtml(x.v)}</td></tr>`,
    )
    .join("");

  const settlement = [
    { k: "Amount Paid", v: money(payroll.amountPaid) },
    { k: "Remaining Balance", v: money(payroll.remainingBalance) },
    ...(lastPayment
      ? [
          { k: "Payment Method", v: paymentMethodLabel(lastPayment.paymentMethod) },
          { k: "Payment Date", v: shortDate(lastPayment.paidAt) },
          { k: "Prepared By", v: lastPayment.paidBy },
        ]
      : []),
  ]
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.k)}</td><td class="v${
          x.k === "Amount Paid" || x.k === "Remaining Balance" ? " num" : ""
        }">${escapeHtml(x.v)}</td></tr>`,
    )
    .join("");

  return shell({
    title: "Salary Payslip",
    subtitle: monthLabel(payroll.payrollMonth),
    refLabel: code ? "Staff ID" : undefined,
    refValue: code || undefined,
    paper: paperOverride ?? d.paper,
    landscape: d.landscape,
    leftSignature: "Employee Signature",
    body: `
  <div class="sec"><div class="card">
    <div class="sec-head">Employee</div>
    <table class="kv">${who}</table>
  </div></div>

  <div class="sec"><div class="card">
    <div class="sec-head">Earnings &amp; Deductions</div>
    <table class="kv">
      ${lines}
      <tr class="total"><td class="k">Net Salary</td>
        <td class="v num">${escapeHtml(money(payroll.netSalary))}</td></tr>
    </table>
  </div></div>

  <div class="sec"><div class="card">
    <div class="sec-head">Settlement</div>
    <table class="kv">${settlement}</table>
  </div></div>

  <div class="note">${escapeHtml(
    payslipFooter || "This is a computer-generated payslip.",
  )}</div>`,
  });
}

export function printPayslip(payroll: PayrollRecord, payment?: SalaryPayment | null) {
  openWindow(payslipHtml(payroll, payment));
}

export function downloadPayslipPdf(payroll: PayrollRecord, payment?: SalaryPayment | null) {
  printPayslip(payroll, payment);
}

// ── The whole payroll, as filtered ──────────────────────────────────────

export interface PayrollReportOptions {
  /** Month, position, status, search — whatever narrowed the list. */
  scope: { label: string; value: string }[];
  rows: PayrollRow[];
  paper?: PaperSize;
  landscape?: boolean;
}

export function payrollReportHtml(opts: PayrollReportOptions): string {
  const d = design("PAYROLL_REPORT");
  const paper = opts.paper ?? d.paper;
  // A payroll sheet has seven columns of figures; landscape is the shape that
  // fits it, so that is the default here rather than the usual portrait.
  const landscape = opts.landscape ?? d.landscape;

  const scope = opts.scope
    .filter((x) => x.value && x.value !== "—")
    .map(
      (x) =>
        `<tr><td class="k">${escapeHtml(x.label)}</td><td class="v">${escapeHtml(x.value)}</td></tr>`,
    )
    .join("");

  // Totalled from the rows being printed, not from the whole month — a report
  // of one position whose total is the school's is a wrong document.
  const total = opts.rows.reduce((n, r) => n + r.netSalary, 0);
  const paid = opts.rows.reduce((n, r) => n + r.amountPaid, 0);
  const due = opts.rows.reduce((n, r) => n + r.remainingBalance, 0);

  const stats = [
    { label: "Employees", value: String(opts.rows.length) },
    { label: "Total Payroll", value: money(total) },
    { label: "Paid", value: money(paid) },
    { label: "Outstanding", value: money(due) },
  ]
    .map(
      (x) => `<div class="stat">
        <div class="stat-l">${escapeHtml(x.label)}</div>
        <div class="stat-v">${escapeHtml(x.value)}</div>
      </div>`,
    )
    .join("");

  const body = opts.rows.length
    ? opts.rows
        .map(
          (r, i) => `<tr>
            <td class="n">${i + 1}</td>
            <td class="mono">${escapeHtml(r.employeeCode || "—")}</td>
            <td>${escapeHtml(r.employeeName)}</td>
            <td>${escapeHtml(r.position)}</td>
            <td class="num">${escapeHtml(money(r.netSalary))}</td>
            <td class="num">${escapeHtml(money(r.amountPaid))}</td>
            <td class="num">${escapeHtml(money(r.remainingBalance))}</td>
            <td>${escapeHtml(payrollStatusLabel(r.status))}</td>
          </tr>`,
        )
        .join("")
    : `<tr><td class="empty" colspan="8">No payroll records match this selection.</td></tr>`;

  return shell({
    title: "Payroll Report",
    paper,
    landscape,
    leftSignature: "Prepared By",
    body: `
  ${
    scope
      ? `<div class="sec"><div class="card">
           <div class="sec-head">Report Scope</div>
           <table class="kv">${scope}</table>
         </div></div>`
      : ""
  }

  <div class="stats">${stats}</div>

  <table class="list">
    <thead><tr>
      <th class="n">#</th><th>Staff ID</th><th>Employee</th><th>Position</th>
      <th class="num">Net Salary</th><th class="num">Paid</th>
      <th class="num">Balance</th><th>Status</th>
    </tr></thead>
    <tbody>${body}</tbody>
    ${
      opts.rows.length
        ? `<tfoot><tr>
             <td></td><td></td><td>Total</td><td></td>
             <td class="num">${escapeHtml(money(total))}</td>
             <td class="num">${escapeHtml(money(paid))}</td>
             <td class="num">${escapeHtml(money(due))}</td>
             <td></td>
           </tr></tfoot>`
        : ""
    }
  </table>`,
  });
}

export function printPayrollReport(opts: PayrollReportOptions): void {
  openWindow(payrollReportHtml(opts));
}

function openWindow(html: string): void {
  const w = window.open("", "_blank", "width=1000,height=1200");
  if (!w) return;
  w.document.write(html);
  w.document.close();
  w.focus();
  // The logo has to decode before the dialog opens or the sheet prints with a
  // hole where the letterhead should be.
  w.onload = () => {
    w.print();
  };
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
