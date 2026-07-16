import { schoolBranding } from "@/lib/settings/store";

interface PrintTableOptions {
  title: string;
  academicYear?: string;
  subtitle?: string;
  columns: string[];
  rows: (string | number)[][];
  preparedBy?: string;
}

export function printTable(opts: PrintTableOptions) {
  const school = schoolBranding();
  const logo = school.logoUrl
    ? `<img src="${school.logoUrl}" alt="" class="logo" style="object-fit:contain"/>`
    : `<div class="logo">${school.name.charAt(0)}</div>`;
  const centered = school.headerLayout === "CENTERED";
  const now = new Date();
  const head = opts.columns.map((c) => `<th>${c}</th>`).join("");
  const body = opts.rows
    .map(
      (r) =>
        `<tr>${r.map((cell) => `<td>${cell ?? ""}</td>`).join("")}</tr>`,
    )
    .join("");

  const html = `<!doctype html><html><head><meta charset="utf-8"/><title>${opts.title}</title>
  <style>
    * { font-family: system-ui, -apple-system, Segoe UI, sans-serif; }
    body { padding: 32px; color: #0f172a; }
    .head { display:flex; align-items:center; gap:12px; border-bottom:2px solid #6366f1; padding-bottom:14px; margin-bottom:18px; }
    .head.centered { flex-direction:column; text-align:center; }
    .logo { width:44px; height:44px; border-radius:10px; background:#6366f1; color:#fff; display:flex; align-items:center; justify-content:center; font-weight:700; font-size:20px; }
    h1 { margin:0; font-size:20px; }
    .muted { color:#64748b; font-size:13px; }
    h2 { font-size:16px; margin:4px 0 12px; }
    table { width:100%; border-collapse:collapse; font-size:13px; }
    th, td { border:1px solid #e2e8f0; padding:8px 10px; text-align:left; }
    th { background:#f1f5f9; font-weight:600; }
    .foot { margin-top:24px; display:flex; justify-content:space-between; font-size:12px; color:#64748b; }
  </style></head><body>
    <div class="head${centered ? " centered" : ""}">
      ${logo}
      <div>
        <h1>${school.name}</h1>
        <div class="muted">${opts.academicYear ? `Academic Year: ${opts.academicYear}` : ""}</div>
      </div>
    </div>
    <h2>${opts.title}</h2>
    ${opts.subtitle ? `<p class="muted">${opts.subtitle}</p>` : ""}
    <table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
    <div class="foot">
      <span>Prepared by: ${opts.preparedBy ?? "Admin User"}</span>
      <span>${now.toLocaleString()}</span>
    </div>
    <script>window.onload = () => { window.print(); }</script>
  </body></html>`;

  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(html);
  w.document.close();
}
