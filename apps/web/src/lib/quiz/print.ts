import { SCHOOL } from "@/lib/students/constants";
import { dateTime, resultLabel } from "./format";
import type { Quiz, QuizAttempt } from "./types";

export function resultHtml(quiz: Quiz, attempt: QuizAttempt): string {
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${quiz.title} Result</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto}
  .head{border-bottom:2px solid #e2e8f0;padding-bottom:20px;margin-bottom:24px}
  h1{font-size:22px}
  .meta{color:#64748b;font-size:13px}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px;text-align:left}
  th{color:#64748b;width:40%}
  .score{font-size:32px;font-weight:700;text-align:center;color:#6366f1;margin:24px 0}
</style></head><body>
  <div class="head">
    <h1>${SCHOOL.name}</h1>
    <div class="meta">Quiz Result — ${quiz.code}</div>
  </div>
  <table>
    <tr><th>Student</th><td>${attempt.studentName} (${attempt.studentCode})</td></tr>
    <tr><th>Quiz</th><td>${quiz.title}</td></tr>
    <tr><th>Subject</th><td>${quiz.subject}</td></tr>
    <tr><th>Class / Section</th><td>${quiz.className} — ${quiz.section}</td></tr>
    <tr><th>Submitted</th><td>${attempt.submittedAt ? dateTime(attempt.submittedAt) : "—"}</td></tr>
    <tr><th>Result</th><td>${resultLabel(attempt.result)}</td></tr>
  </table>
  <div class="score">${attempt.obtainedMarks ?? "—"} / ${attempt.totalMarks} (${attempt.percentage ?? "—"}%)</div>
</body></html>`;
}

export function printQuizResult(quiz: Quiz, attempt: QuizAttempt) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(resultHtml(quiz, attempt));
  w.document.close();
  w.focus();
  w.print();
}
