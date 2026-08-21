import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import {
  dateTime,
  money,
  paymentMethodLabel,
  shortDate,
} from "./format";
import { categoryName } from "./store";
import type { Expense } from "./types";

export function expenseHtml(expense: Expense, preparedBy = "Admin User"): string {
  const { expenseHeader, expenseFooter } = getSettings().expenses;
  const cat = categoryName(expense.categoryId);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${expense.referenceNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:760px;margin:0 auto}
  ${PRINT_HEADER_CSS}
  .ref{font-size:14px;color:#64748b}
  .ref strong{display:block;font-size:20px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:38%;color:#64748b;font-weight:500}
  .amount{font-size:28px;font-weight:700;color:#dc2626;text-align:center;margin:24px 0}
  .sign{margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b;width:240px}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
  ${printHeaderHtml(
    `${expenseHeader || "Expense Record"} · Academic Year: ${expense.academicYear}`,
    `<div class="ref">Reference<strong>${expense.referenceNo}</strong></div>`,
  )}
  <table>
    <tr><th>Expense Title</th><td>${expense.title}</td></tr>
    <tr><th>Category</th><td>${cat}</td></tr>
    <tr><th>Vendor / Paid To</th><td>${expense.paidTo}</td></tr>
    <tr><th>Payment Method</th><td>${paymentMethodLabel(expense.paymentMethod)}</td></tr>
    <tr><th>Expense Date</th><td>${shortDate(expense.expenseDate)}</td></tr>
    <tr><th>Recorded By</th><td>${expense.recordedBy}</td></tr>
    <tr><th>Created</th><td>${dateTime(expense.createdAt)}</td></tr>
    <tr><th>Last Updated</th><td>${dateTime(expense.updatedAt)}</td></tr>
    ${expense.description ? `<tr><th>Description</th><td>${expense.description}</td></tr>` : ""}
  </table>
  <div class="amount">Amount: ${money(expense.amount)}</div>
  <div class="sign">Authorized Signature — ${preparedBy}</div>
  <div class="foot">${expenseFooter || `Generated ${dateTime(new Date().toISOString())}`}</div>
</body></html>`;
}

export function printExpense(expense: Expense) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(expenseHtml(expense));
  w.document.close();
  w.focus();
  w.print();
}

export function reportHtml(opts: {
  title: string;
  academicYear: string;
  rows: { label: string; amount: number }[];
  total: number;
  preparedBy?: string;
}): string {
  const rows = opts.rows
    .map(
      (r) =>
        `<tr><td>${r.label}</td><td style="text-align:right">${money(r.amount)}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${opts.title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:800px;margin:0 auto}
  ${PRINT_HEADER_CSS}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{text-align:left;color:#64748b}
  .total{font-size:24px;font-weight:700;text-align:right;margin-top:20px;color:#dc2626}
  .sign{margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b;width:240px}
</style></head><body>
  ${printHeaderHtml(`${opts.title} · ${opts.academicYear} · ${dateTime(new Date().toISOString())}`)}
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Amount</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <div class="total">Total: ${money(opts.total)}</div>
  <div class="sign">Prepared By: ${opts.preparedBy ?? "Admin User"}</div>
</body></html>`;
}

export function printExpenseReport(opts: Parameters<typeof reportHtml>[0]) {
  const w = window.open("", "_blank", "width=900,height=900");
  if (!w) return;
  w.document.write(reportHtml(opts));
  w.document.close();
  w.focus();
  w.print();
}
