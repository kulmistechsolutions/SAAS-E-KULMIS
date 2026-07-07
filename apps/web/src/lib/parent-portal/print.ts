"use client";

import { BRAND } from "@/lib/brand";
import { SCHOOL } from "@/lib/students/constants";
import { shortDate, statusLabel } from "@/lib/students/format";
import type { Student } from "@/lib/students/types";
import type { FeePayment } from "@/lib/fees/types";
import { attendanceHistory } from "@/lib/students/history";
import type { StudentExamResult } from "@/lib/examinations/types";

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function printWindow(title: string, body: string) {
  const w = window.open("", "_blank", "width=800,height=700");
  if (!w) return;
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(title)}</title>
  <style>
    *{font-family:Arial,sans-serif;box-sizing:border-box}body{padding:32px;color:#0f172a}
    .head{display:flex;gap:16px;border-bottom:2px solid #4f46e5;padding-bottom:16px;margin-bottom:20px}
    .logo{width:52px;height:52px;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#4f46e5);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:18px}
    h2{font-size:14px;margin:16px 0 6px;color:#4f46e5}
    table{width:100%;border-collapse:collapse;font-size:13px}
    td,th{border:1px solid #e2e8f0;padding:7px 10px}
    th{background:#f8fafc;text-align:left}
    .muted{color:#64748b;font-size:12px}
  </style></head><body>
  <div class="head"><div class="logo">${escapeHtml(BRAND.name.slice(0, 2).toUpperCase())}</div>
  <div><h1 style="margin:0;font-size:20px">${escapeHtml(SCHOOL.name)}</h1>
  <div class="muted">${escapeHtml(title)}</div></div></div>
  ${body}
  <p class="muted" style="margin-top:24px">Printed ${new Date().toLocaleString()}</p>
  </body></html>`);
  w.document.close();
  w.focus();
  w.print();
}

export function printAttendanceReport(student: Student) {
  const att = attendanceHistory(student, 60);
  const rows = att.rows
    .map(
      (r) =>
        `<tr><td>${shortDate(r.date)}</td><td>${r.status}</td></tr>`,
    )
    .join("");
  printWindow(
    `Attendance — ${student.fullName}`,
    `<p><strong>${escapeHtml(student.fullName)}</strong> · ${escapeHtml(student.className)}${student.section ? ` — ${escapeHtml(student.section)}` : ""}</p>
    <p>Present: ${att.present} · Absent: ${att.absent} · Late: ${att.late} · Rate: ${att.percentage}%</p>
    <table><thead><tr><th>Date</th><th>Status</th></tr></thead><tbody>${rows}</tbody></table>`,
  );
}

export function printResultSlip(student: Student, result: StudentExamResult) {
  const subjects = result.subjects
    .map(
      (s) =>
        `<tr><td>${escapeHtml(s.subject)}</td><td>${s.maxMarks}</td><td>${s.marksObtained}</td><td>${escapeHtml(s.grade)}</td><td>${s.marksObtained >= s.maxMarks * 0.4 ? "Pass" : "Fail"}</td></tr>`,
    )
    .join("");
  const avgPct = result.subjects[0]?.maxMarks
    ? Math.round((result.average / result.subjects[0].maxMarks) * 100)
    : 0;
  printWindow(
    `Result — ${result.examName}`,
    `<p><strong>${escapeHtml(student.fullName)}</strong> · ${escapeHtml(result.examName)}</p>
    <p>Overall: ${avgPct}% · Grade ${escapeHtml(result.grade)} · ${result.passed ? "Pass" : "Fail"}</p>
    <table><thead><tr><th>Subject</th><th>Max</th><th>Obtained</th><th>Grade</th><th>Result</th></tr></thead><tbody>${subjects}</tbody></table>`,
  );
}

export function printFeeReceipt(payment: FeePayment, studentName: string) {
  printWindow(
    `Receipt ${payment.receiptNo}`,
    `<table>
    <tr><th>Receipt No</th><td>${escapeHtml(payment.receiptNo)}</td></tr>
    <tr><th>Student</th><td>${escapeHtml(studentName)}</td></tr>
    <tr><th>Amount</th><td>$${payment.amount.toLocaleString()}</td></tr>
    <tr><th>Type</th><td>${escapeHtml(payment.paymentType.replace(/_/g, " "))}</td></tr>
    <tr><th>Date</th><td>${shortDate(payment.collectedAt)}</td></tr>
    <tr><th>Outstanding After</th><td>$${payment.outstandingAfter.toLocaleString()}</td></tr>
    </table>`,
  );
}

export function printFeeStatement(student: Student, rows: { monthLabel: string; monthlyCharge: number; amountPaid: number; remainingBalance: number; status: string }[]) {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${escapeHtml(r.monthLabel)}</td><td>$${r.monthlyCharge}</td><td>$${r.amountPaid}</td><td>$${r.remainingBalance}</td><td>${escapeHtml(r.status)}</td></tr>`,
    )
    .join("");
  printWindow(
    `Fee Statement — ${student.fullName}`,
    `<p><strong>${escapeHtml(student.fullName)}</strong> · ${escapeHtml(student.code)} · ${statusLabel(student.status)}</p>
    <table><thead><tr><th>Month</th><th>Charge</th><th>Paid</th><th>Balance</th><th>Status</th></tr></thead><tbody>${body}</tbody></table>`,
  );
}
