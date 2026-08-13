import { getSettings, schoolBranding } from "@/lib/settings/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { feeStatusLabel, monthLabel, money, paymentTypeLabel, receiptDate } from "./format";
import type { ClassFeeSummary, FeePayment, StudentFeeRow } from "./types";
import { outstandingBalance } from "./store";
import { dirOf } from "@/lib/i18n/config";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function receiptHtml(payment: FeePayment): string {
  const school = schoolBranding();
  const { receiptHeader, receiptFooter } = getSettings().fees;
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);
  const months = payment.monthKeys.map(monthLabel).join(", ");
  const outstanding = student
    ? outstandingBalance(student.id)
    : payment.outstandingAfter;
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";

  // Print windows have no React tree to pull useT() from — read the same
  // language the rest of the app is showing straight off the cookie, so a
  // printed receipt matches whatever language is active, not always English.
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${payment.receiptNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto}
  .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
  .head.centered{flex-direction:column;text-align:center}
  .head.centered .receipt-no{text-align:center;margin-top:8px}
  .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}
  h1{font-size:22px}
  .meta{color:#64748b;font-size:13px;margin-top:4px}
  .receipt-no{text-align:end;font-size:14px;color:#64748b;margin-inline-start:auto}
  .receipt-no strong{display:block;font-size:20px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:start;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:40%;color:#64748b;font-weight:500}
  .amount{font-size:28px;font-weight:700;color:#16a34a;text-align:center;margin:24px 0}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
  <div class="head${centered ? " centered" : ""}">
    ${logo}
    <div>
      <h1>${school.name}</h1>
      ${receiptHeader ? `<div class="meta">${receiptHeader}</div>` : `<div class="meta">${tr("feesReceiptPrint.feeReceiptDefault")}</div>`}
    </div>
    <div class="receipt-no">${tr("feesReceiptPrint.receiptNo")}<strong>${payment.receiptNo}</strong></div>
  </div>
  <table>
    <tr><th>${tr("feesReceiptPrint.studentName")}</th><td>${student?.fullName ?? "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.studentId")}</th><td>${student?.code ?? "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.classSection")}</th><td>${student?.className ?? "—"} — ${student?.section ?? "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.paymentType")}</th><td>${paymentTypeLabel(payment.paymentType, payment.advanceMonths)}</td></tr>
    <tr><th>${tr("feesReceiptPrint.monthS")}</th><td>${months || "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.collectedBy")}</th><td>${payment.collectedBy}</td></tr>
    <tr><th>${tr("feesReceiptPrint.collectionDate")}</th><td>${receiptDate(payment.collectedAt)}</td></tr>
    <tr><th>${tr("feesReceiptPrint.outstandingBalance")}</th><td>${money(outstanding)}</td></tr>
  </table>
  <div class="amount">${tr("feesReceiptPrint.amountPaid")} ${money(payment.amount)}</div>
  <div class="foot">${receiptFooter || tr("feesReceiptPrint.defaultFooter")}</div>
</body></html>`;
}

export function printReceipt(payment: FeePayment) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(receiptHtml(payment));
  w.document.close();
  w.focus();
  w.print();
}

export function exportPaymentsCsv(payments: FeePayment[]) {
  const students = getStudentsState().students;
  const header =
    "Receipt No,Student ID,Student Name,Class,Section,Amount,Payment Type,Collected By,Date\n";
  const rows = payments
    .map((p) => {
      const st = students.find((s) => s.id === p.studentId);
      return [
        p.receiptNo,
        st?.code ?? "",
        `"${st?.fullName ?? ""}"`,
        st?.className ?? "",
        st?.section ?? "",
        p.amount,
        paymentTypeLabel(p.paymentType, p.advanceMonths),
        p.collectedBy,
        p.collectedAt.slice(0, 10),
      ].join(",");
    })
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fee-payments.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function printClassFeeSummaries(
  summaries: ClassFeeSummary[],
  meta: { academicYear: string; monthLabel: string },
) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const lang = getStoredLang();
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);
  const body = summaries
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.className)}</td>
        <td>${c.totalStudents}</td>
        <td>${money(c.outstandingAmount)}</td>
        <td>${c.paidStudents}</td>
        <td>${c.advanceStudents}</td>
        <td>${c.partialStudents}</td>
      </tr>`,
    )
    .join("");
  const totals = summaries.reduce(
    (acc, c) => ({
      students: acc.students + c.totalStudents,
      outstanding: acc.outstanding + c.outstandingAmount,
      paid: acc.paid + c.paidStudents,
      advance: acc.advance + c.advanceStudents,
      partial: acc.partial + c.partialStudents,
    }),
    { students: 0, outstanding: 0, paid: 0, advance: 0, partial: 0 },
  );
  w.document.write(`<!DOCTYPE html><html><head><title>${tr("feesClassFeeSummary.title")}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    tfoot td{font-weight:700;background:#f8fafc}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">
    ${logo}
    <div>
      <h1>${escapeHtml(school.name)}</h1>
      <div class="meta">${tr("feesClassFeeSummary.title")} · ${meta.academicYear} · ${meta.monthLabel}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>${tr("feesClassFeeSummary.class")}</th>
      <th>${tr("feesClassFeeSummary.totalStudents")}</th>
      <th>${tr("feesClassFeeSummary.outstanding")}</th>
      <th>${tr("feesClassFeeSummary.paid")}</th>
      <th>${tr("feesClassFeeSummary.advance")}</th>
      <th>${tr("feesClassFeeSummary.partial")}</th>
    </tr></thead>
    <tbody>${body || '<tr><td colspan="6">No classes</td></tr>'}</tbody>
    <tfoot><tr>
      <td>${tr("feesClassFeeSummary.total")}</td>
      <td>${totals.students}</td>
      <td>${money(totals.outstanding)}</td>
      <td>${totals.paid}</td>
      <td>${totals.advance}</td>
      <td>${totals.partial}</td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function printClassCollectionList(
  rows: StudentFeeRow[],
  meta: { academicYear: string; monthLabel: string; className: string; section: string; status: string },
) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const lang = getStoredLang();
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);
  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.code)}</td>
        <td>${escapeHtml(r.fullName)}</td>
        <td>${escapeHtml(r.className)}${r.section && r.section !== "—" ? " - " + escapeHtml(r.section) : ""}</td>
        <td>${money(r.monthlyFee)}</td>
        <td>${money(r.outstandingBalance)}</td>
        <td>${feeStatusLabel(r.status, r.advanceMonthsLeft)}</td>
      </tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${tr("feesClassFeeSummary.collectionListTitle")}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:16px}
    .head.centered{flex-direction:column;text-align:center}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:20px}
    h1{margin:0;font-size:20px}
    .meta{color:#475569;font-size:13px;margin-top:4px}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  <div class="head${centered ? " centered" : ""}">
    ${logo}
    <div>
      <h1>${escapeHtml(school.name)}</h1>
      <div class="meta">${tr("feesClassFeeSummary.collectionListTitle")} · ${meta.academicYear} · ${meta.monthLabel} · ${escapeHtml(meta.className)}${meta.section ? " - " + escapeHtml(meta.section) : ""} · ${meta.status}</div>
    </div>
  </div>
  <table>
    <thead><tr>
      <th>#</th>
      <th>${tr("feesCollectFeesSection.studentId")}</th>
      <th>${tr("feesCollectFeesSection.studentName")}</th>
      <th>${tr("feesCollectFeesSection.class")}</th>
      <th>${tr("feesCollectFeesSection.monthlyFee")}</th>
      <th>${tr("feesCollectFeesSection.outstandingBalance")}</th>
      <th>${tr("feesCollectFeesSection.status")}</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="7">${tr("feesCollectFeesSection.noStudentsMatchYourFilters")}</td></tr>`}</tbody>
  </table>
  <div class="foot">Total: ${rows.length} · Generated ${new Date().toLocaleString()}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}
