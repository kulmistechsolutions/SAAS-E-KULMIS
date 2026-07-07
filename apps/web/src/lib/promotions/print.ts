import { SCHOOL } from "@/lib/brand";
import { getStudentWithParent } from "@/lib/students/store";
import { studentPromotionHistory } from "./store";
import { dateTime, shortDate } from "./format";

export { printTable } from "@/lib/academics/print";

/** Print a graduation transcript / promotion history for a single student. */
export function printTranscript(studentId: string) {
  const sw = getStudentWithParent(studentId);
  if (!sw) return;
  const history = studentPromotionHistory(studentId);
  const now = new Date();

  const rows = history
    .map(
      (r) =>
        `<tr>
          <td>${shortDate(r.promotedAt)}</td>
          <td>${r.fromClass}${r.fromSection ? ` (${r.fromSection})` : ""}</td>
          <td>${r.graduated ? "Graduated" : `${r.toClass}${r.toSection ? ` (${r.toSection})` : ""}`}</td>
          <td>${r.fromAcademicYear}</td>
          <td>${r.promotedBy}</td>
        </tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>Transcript — ${sw.fullName}</title>
  <style>
    * { font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    body { padding: 32px; color: #0f172a; }
    .head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #6366f1; padding-bottom:14px; margin-bottom:18px; }
    .logo { width:44px; height:44px; border-radius:10px; background:#6366f1; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#64748b; font-size:13px; }
    h2 { font-size:16px; margin:18px 0 10px; }
    .info { display:grid; grid-template-columns:repeat(2,1fr); gap:8px 24px; font-size:13px; }
    .info div span { color:#64748b; }
    table { width:100%; border-collapse:collapse; font-size:13px; margin-top:6px; }
    th, td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; }
    th { background:#f1f5f9; font-weight:600; }
    .foot { margin-top:24px; display:flex; justify-content:space-between; font-size:12px; color:#64748b; }
    .badge { display:inline-block; padding:2px 10px; border-radius:9999px; background:#dcfce7; color:#166534; font-size:12px; font-weight:600; }
  </style></head><body>
    <div class="head">
      <div class="logo">${SCHOOL.shortName.charAt(0)}</div>
      <div>
        <h1>${SCHOOL.name}</h1>
        <div class="muted">Official Student Transcript</div>
      </div>
    </div>
    <div class="info">
      <div><span>Student Name:</span> <b>${sw.fullName}</b></div>
      <div><span>Student ID:</span> <b>${sw.code}</b></div>
      <div><span>Parent / Guardian:</span> <b>${sw.parent.name}</b></div>
      <div><span>Gender:</span> <b>${sw.gender.charAt(0) + sw.gender.slice(1).toLowerCase()}</b></div>
      <div><span>Status:</span> <span class="badge">${sw.status}</span></div>
      <div><span>Current / Final Class:</span> <b>${sw.className}${sw.section ? ` — Section ${sw.section}` : ""}</b></div>
    </div>
    <h2>Promotion &amp; Graduation History</h2>
    <table>
      <thead><tr><th>Date</th><th>From</th><th>To</th><th>Academic Year</th><th>Processed By</th></tr></thead>
      <tbody>${rows || `<tr><td colspan="5" style="text-align:center;color:#64748b;">No promotion records.</td></tr>`}</tbody>
    </table>
    <div class="foot">
      <span>Prepared by: Admin User</span>
      <span>${dateTime(now.toISOString())}</span>
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
