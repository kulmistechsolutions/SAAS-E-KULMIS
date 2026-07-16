import { schoolBranding } from "@/lib/settings/store";
import {
  dateTime,
  money,
  paymentMethodLabel,
  shortDate,
} from "./format";
import { categoryName } from "./store";
import type { Expense } from "./types";

export function expenseHtml(expense: Expense, preparedBy = "Admin User"): string {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:cover"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const cat = categoryName(expense.categoryId);
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${expense.referenceNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:760px;margin:0 auto}
  .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
  .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#ef4444,#f97316);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}
  h1{font-size:22px}
  .meta{color:#64748b;font-size:13px;margin-top:4px}
  .ref{margin-left:auto;text-align:right;font-size:14px;color:#64748b}
  .ref strong{display:block;font-size:20px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:38%;color:#64748b;font-weight:500}
  .amount{font-size:28px;font-weight:700;color:#dc2626;text-align:center;margin:24px 0}
  .sign{margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b;width:240px}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
  <div class="head">
    ${logo}
    <div>
      <h1>${school.name}</h1>
      <div class="meta">Expense Record</div>
      <div class="meta">Academic Year: ${expense.academicYear}</div>
    </div>
    <div class="ref">Reference<strong>${expense.referenceNo}</strong></div>
  </div>
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
  <div class="foot">Generated ${dateTime(new Date().toISOString())} · eKulmis Expense Management</div>
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
  const school = schoolBranding();
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
  h1{font-size:22px;margin-bottom:4px}
  .meta{color:#64748b;font-size:13px;margin-bottom:24px}
  table{width:100%;border-collapse:collapse}
  th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{text-align:left;color:#64748b}
  .total{font-size:24px;font-weight:700;text-align:right;margin-top:20px;color:#dc2626}
  .sign{margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b;width:240px}
</style></head><body>
  <h1>${school.name}</h1>
  <div class="meta">${opts.title} · ${opts.academicYear} · ${dateTime(new Date().toISOString())}</div>
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
