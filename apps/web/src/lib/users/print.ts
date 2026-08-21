import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { dateTime, roleLabel, shortDate } from "./format";
import type { SystemUser } from "./types";

export function userProfileHtml(user: SystemUser): string {
  const { reportHeader, reportFooter } = getSettings().school;
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${user.userId}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:40px;color:#0f172a;max-width:720px;margin:0 auto}
  ${PRINT_HEADER_CSS}
  table{width:100%;border-collapse:collapse}
  th,td{text-align:left;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:38%;color:#64748b}
  .sign{margin-top:48px;border-top:1px solid #cbd5e1;padding-top:8px;font-size:12px;color:#64748b;width:240px}
</style></head><body>
  ${printHeaderHtml(reportHeader || "User Profile Report")}
  <table>
    <tr><th>User ID</th><td>${user.userId}</td></tr>
    <tr><th>Full Name</th><td>${user.fullName}</td></tr>
    <tr><th>Username</th><td>${user.username}</td></tr>
    <tr><th>Role</th><td>${roleLabel(user.role)}</td></tr>
    <tr><th>Status</th><td>${user.status}</td></tr>
    <tr><th>Last Login</th><td>${user.lastLogin ? dateTime(user.lastLogin) : "—"}</td></tr>
    <tr><th>Created</th><td>${dateTime(user.createdAt)}</td></tr>
  </table>
  <div class="sign">${reportFooter || "Prepared By: Administrator"}</div>
</body></html>`;
}

export function printUserProfile(user: SystemUser) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(userProfileHtml(user));
  w.document.close();
  w.focus();
  w.print();
}

export function userListReportHtml(
  rows: { userId: string; fullName: string; username: string; roleLabel: string; status: string }[],
  title: string,
): string {
  const body = rows
    .map(
      (r) =>
        `<tr><td>${r.userId}</td><td>${r.fullName}</td><td>${r.username}</td><td>${r.roleLabel}</td><td>${r.status}</td></tr>`,
    )
    .join("");
  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/><title>${title}</title>
<style>
  body{font-family:system-ui,sans-serif;padding:32px;color:#0f172a}
  ${PRINT_HEADER_CSS}
  table{width:100%;border-collapse:collapse;font-size:13px}
  th,td{border:1px solid #e2e8f0;padding:8px 10px;text-align:left}
  th{background:#f8fafc}
  .sign{margin-top:40px;font-size:12px;color:#64748b}
</style></head><body>
  ${printHeaderHtml(`${title} · Generated ${shortDate(new Date().toISOString())}`)}
  <table>
    <thead><tr><th>User ID</th><th>Name</th><th>Username</th><th>Role</th><th>Status</th></tr></thead>
    <tbody>${body}</tbody>
  </table>
  <div class="sign">Authorized Signature</div>
</body></html>`;
}

export function printUserListReport(
  rows: Parameters<typeof userListReportHtml>[0],
  title: string,
) {
  const w = window.open("", "_blank", "width=1000,height=900");
  if (!w) return;
  w.document.write(userListReportHtml(rows, title));
  w.document.close();
  w.focus();
  w.print();
}
