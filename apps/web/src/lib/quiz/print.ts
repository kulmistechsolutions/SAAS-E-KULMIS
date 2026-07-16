import type { QuizAttemptReview } from "./api";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function attemptReviewPdfHtml(review: QuizAttemptReview): string {
  const logo = review.logoUrl
    ? `<img src="${esc(review.logoUrl)}" alt="" style="height:56px;width:56px;object-fit:cover;border-radius:10px"/>`
    : "";
  const rows = review.questions
    .map(
      (q) => `
    <div class="q">
      <div class="qhead">
        <strong>Question ${q.number}</strong>
        <span class="badge ${q.status.toLowerCase()}">${
          q.status === "CORRECT"
            ? "Correct"
            : q.status === "INCORRECT"
              ? "Incorrect"
              : "Not Answered"
        }</span>
      </div>
      <p class="prompt">${esc(q.question)}</p>
      <table class="ans">
        <tr><th>Your Answer</th><td>${esc(q.studentAnswer) || "—"}</td></tr>
        <tr><th>Correct Answer</th><td>${esc(q.correctAnswer) || "—"}</td></tr>
        <tr><th>Marks</th><td>${q.marksAwarded} / ${q.maxMarks}</td></tr>
      </table>
      ${
        q.explanation
          ? `<p class="expl"><strong>Explanation:</strong> ${esc(q.explanation)}</p>`
          : ""
      }
    </div>`,
    )
    .join("");

  const mins = Math.floor(review.timeTakenSec / 60);
  const secs = review.timeTakenSec % 60;

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${esc(review.quiz.title)} — Result</title>
<style>
  @page { margin: 18mm; }
  body{font-family:Georgia,"Times New Roman",serif;color:#0f172a;max-width:800px;margin:0 auto;padding:24px;line-height:1.45}
  .brand{display:flex;gap:14px;align-items:center;border-bottom:2px solid #0f766e;padding-bottom:16px;margin-bottom:20px}
  .brand h1{font-size:20px;margin:0}
  .brand p{margin:2px 0 0;color:#64748b;font-size:12px}
  .hero{text-align:center;margin:20px 0 28px}
  .hero h2{font-size:22px;margin:0 0 6px}
  .pill{display:inline-block;padding:4px 14px;border-radius:999px;font-size:12px;font-weight:700;
    background:${review.result === "PASS" ? "#d1fae5" : "#fee2e2"};
    color:${review.result === "PASS" ? "#065f46" : "#991b1b"}}
  .score{font-size:36px;font-weight:700;color:#0f766e;margin:12px 0 4px}
  .meta{width:100%;border-collapse:collapse;margin:16px 0 28px;font-size:13px}
  .meta th,.meta td{border-bottom:1px solid #e2e8f0;padding:8px 10px;text-align:left}
  .meta th{width:34%;color:#64748b;font-weight:600}
  .q{border:1px solid #e2e8f0;border-radius:12px;padding:14px 16px;margin-bottom:14px;page-break-inside:avoid}
  .qhead{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;font-size:13px}
  .badge{font-size:11px;padding:2px 8px;border-radius:999px;font-weight:600}
  .badge.correct{background:#d1fae5;color:#065f46}
  .badge.incorrect{background:#fee2e2;color:#991b1b}
  .badge.unanswered{background:#f1f5f9;color:#475569}
  .prompt{margin:0 0 10px;font-size:14px}
  .ans{width:100%;border-collapse:collapse;font-size:12px}
  .ans th,.ans td{padding:6px 8px;border-bottom:1px solid #f1f5f9;vertical-align:top}
  .ans th{width:28%;color:#64748b;font-weight:600}
  .expl{margin:10px 0 0;font-size:12px;background:#fffbeb;border:1px solid #fde68a;padding:8px 10px;border-radius:8px}
  .foot{margin-top:28px;padding-top:12px;border-top:1px solid #e2e8f0;font-size:11px;color:#64748b;text-align:center}
</style></head><body>
  <div class="brand">
    ${logo}
    <div>
      <h1>${esc(review.schoolName)}</h1>
      <p>Official Quiz Result Sheet · ${esc(review.quiz.code)}</p>
    </div>
  </div>
  <div class="hero">
    <h2>${esc(review.quiz.title)}</h2>
    <div class="pill">${esc(review.result ?? "—")} · Grade ${esc(review.grade)}</div>
    <div class="score">${review.marksObtained} / ${review.totalMarks}</div>
    <div style="color:#64748b;font-size:13px">${review.percentage}% · Time ${mins}m ${secs}s</div>
  </div>
  <table class="meta">
    <tr><th>Student</th><td>${esc(review.student.name)} (${esc(review.student.code)})</td></tr>
    <tr><th>Class / Section</th><td>${esc(review.student.className)}${review.student.section ? ` — ${esc(review.student.section)}` : ""}</td></tr>
    <tr><th>Subject</th><td>${esc(review.quiz.subject) || "—"}</td></tr>
    <tr><th>Teacher</th><td>${esc(review.quiz.teacherName)}</td></tr>
    <tr><th>Date</th><td>${new Date(review.date).toLocaleString()}</td></tr>
    <tr><th>Attempted / Correct / Incorrect</th><td>${review.attempted} / ${review.correct} / ${review.incorrect} (unanswered ${review.unanswered})</td></tr>
  </table>
  <h3 style="font-size:15px;margin:0 0 12px">Question Review</h3>
  ${rows}
  <div class="foot">${esc(review.resultFooter) || esc(review.schoolName) + " · Confidential student assessment record"}</div>
</body></html>`;
}

export function printAttemptReviewPdf(review: QuizAttemptReview) {
  const w = window.open("", "_blank", "width=900,height=1000");
  if (!w) return;
  w.document.write(attemptReviewPdfHtml(review));
  w.document.close();
  w.focus();
  setTimeout(() => w.print(), 400);
}
