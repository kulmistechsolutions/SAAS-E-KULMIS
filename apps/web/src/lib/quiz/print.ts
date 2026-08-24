import type { QuizAttemptReview } from "./api";
import { resolveLogoUrl } from "@/lib/settings/api";

function esc(s: string | null | undefined): string {
  return (s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function attemptReviewPdfHtml(review: QuizAttemptReview): string {
  // On the local storage backend the server cannot mint a direct URL, so
  // `logoUrl` is always null in production and this sheet went out unbranded.
  // `logoKey` is returned alongside it for exactly this reason — fall back to
  // the public logo endpoint, the same way every other screen does.
  const logoSrc = resolveLogoUrl(review.logoUrl, review.logoKey ?? null);
  const logo = logoSrc
    ? `<img src="${esc(logoSrc)}" alt="" style="height:56px;width:56px;object-fit:contain;border-radius:10px"/>`
    : "";
  const rows = review.questions
    .map((q) => {
      const right = q.status === "CORRECT";
      const missed = q.status === "UNANSWERED";
      // The student's answer and the right answer are the two things this page
      // exists to compare, so they sit side by side, each labelled and colour-
      // coded, rather than as two rows of a table that read the same.
      const verdict = right
        ? { label: "Correct", cls: "ok", mark: "✓" }
        : missed
          ? { label: "Not answered", cls: "skip", mark: "–" }
          : { label: "Incorrect", cls: "bad", mark: "✗" };
      return `
    <div class="q ${verdict.cls}">
      <div class="qhead">
        <span class="qnum">${q.number}</span>
        <p class="prompt">${esc(q.question)}</p>
        <span class="badge ${verdict.cls}">${verdict.mark} ${verdict.label}</span>
      </div>
      <div class="cmp">
        <div class="cell ${right ? "ok" : missed ? "skip" : "bad"}">
          <span class="lbl">Student's answer</span>
          <span class="val">${esc(q.studentAnswer) || "<em>left blank</em>"}</span>
        </div>
        <div class="cell ok">
          <span class="lbl">Correct answer</span>
          <span class="val">${esc(q.correctAnswer) || "—"}</span>
        </div>
        <div class="cell marks">
          <span class="lbl">Marks</span>
          <span class="val big">${q.marksAwarded}<small> / ${q.maxMarks}</small></span>
        </div>
      </div>
      ${
        q.explanation
          ? `<p class="expl"><strong>Explanation:</strong> ${esc(q.explanation)}</p>`
          : ""
      }
    </div>`;
    })
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
  /* A coloured spine down the left tells right from wrong before a word is
     read; the label inside each cell says which answer is whose. */
  .q{border:1px solid #e2e8f0;border-inline-start-width:5px;border-radius:12px;
     padding:14px 16px;margin-bottom:14px;page-break-inside:avoid}
  .q.ok{border-inline-start-color:#10b981}
  .q.bad{border-inline-start-color:#ef4444}
  .q.skip{border-inline-start-color:#cbd5e1}
  .qhead{display:flex;gap:10px;align-items:flex-start;margin-bottom:12px}
  .qnum{flex:0 0 24px;height:24px;border-radius:50%;background:#0f172a;color:#fff;
        font-size:12px;font-weight:700;display:flex;align-items:center;justify-content:center}
  .prompt{margin:2px 0 0;font-size:14px;font-weight:600;flex:1}
  .badge{flex:0 0 auto;font-size:11px;padding:3px 10px;border-radius:999px;font-weight:700;white-space:nowrap}
  .badge.ok{background:#d1fae5;color:#065f46}
  .badge.bad{background:#fee2e2;color:#991b1b}
  .badge.skip{background:#f1f5f9;color:#475569}
  /* Student answer and correct answer side by side — the whole point of the
     sheet is telling them apart at a glance. */
  .cmp{display:flex;gap:10px;flex-wrap:wrap}
  .cell{flex:1 1 200px;border:1px solid #e2e8f0;border-radius:9px;padding:8px 10px;background:#f8fafc}
  .cell.ok{border-color:#a7f3d0;background:#ecfdf5}
  .cell.bad{border-color:#fecaca;background:#fef2f2}
  .cell.skip{border-color:#e2e8f0;background:#f8fafc}
  .cell.marks{flex:0 0 92px;text-align:center;background:#fff}
  .lbl{display:block;font-size:10px;text-transform:uppercase;letter-spacing:.05em;
       color:#64748b;font-weight:700;margin-bottom:3px}
  .val{display:block;font-size:13px}
  .val.big{font-size:20px;font-weight:700}
  .val.big small{font-size:12px;font-weight:400;color:#64748b}
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
