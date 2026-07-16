import { schoolBranding } from "@/lib/settings/store";
import { getState as getStudentsState } from "@/lib/students/store";
import { monthLabel, money, paymentTypeLabel, receiptDate } from "./format";
import type { FeePayment } from "./types";
import { outstandingBalance } from "./store";

export function receiptHtml(payment: FeePayment): string {
  const school = schoolBranding();
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);
  const months = payment.monthKeys.map(monthLabel).join(", ");
  const outstanding = student
    ? outstandingBalance(student.id)
    : payment.outstandingAfter;
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:cover"/>`
    : `<div class="logo">${school.name.slice(0, 2).toUpperCase()}</div>`;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${payment.receiptNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto}
  .head{display:flex;align-items:center;gap:16px;border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
  .logo{width:56px;height:56px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#6366f1);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:20px}
  h1{font-size:22px}
  .meta{color:#64748b;font-size:13px;margin-top:4px}
  .receipt-no{text-align:right;font-size:14px;color:#64748b}
  .receipt-no strong{display:block;font-size:20px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:40%;color:#64748b;font-weight:500}
  .amount{font-size:28px;font-weight:700;color:#16a34a;text-align:center;margin:24px 0}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
  @media print{body{padding:20px}}
</style></head><body>
  <div class="head">
    ${logo}
    <div>
      <h1>${school.name}</h1>
      <div class="meta">Fee Receipt</div>
    </div>
    <div class="receipt-no">Receipt No.<strong>${payment.receiptNo}</strong></div>
  </div>
  <table>
    <tr><th>Student Name</th><td>${student?.fullName ?? "—"}</td></tr>
    <tr><th>Student ID</th><td>${student?.code ?? "—"}</td></tr>
    <tr><th>Class / Section</th><td>${student?.className ?? "—"} — ${student?.section ?? "—"}</td></tr>
    <tr><th>Payment Type</th><td>${paymentTypeLabel(payment.paymentType, payment.advanceMonths)}</td></tr>
    <tr><th>Month(s)</th><td>${months || "—"}</td></tr>
    <tr><th>Collected By</th><td>${payment.collectedBy}</td></tr>
    <tr><th>Collection Date</th><td>${receiptDate(payment.collectedAt)}</td></tr>
    <tr><th>Outstanding Balance</th><td>${money(outstanding)}</td></tr>
  </table>
  <div class="amount">Amount Paid: ${money(payment.amount)}</div>
  <div class="foot">This is a computer-generated receipt. Thank you for your payment.</div>
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
