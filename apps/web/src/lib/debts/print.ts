import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { money, shortDate } from "@/lib/students/format";
import { dirOf } from "@/lib/i18n/config";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import { getStoredPaper, paperCss, type PaperSize } from "@/lib/print/paper";
import type { SchoolDebtDetail } from "./types";

/**
 * A printable statement for one debt — the loan and every repayment against
 * it, in one document. Deliberately not a snapshot saved anywhere: it renders
 * straight from the ledger at the moment of printing, the same way an
 * invoice does, so a reprint next month reflects whatever has been paid
 * since.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function debtStatementHtml(
  debt: SchoolDebtDetail,
  paper: PaperSize = getStoredPaper(),
): string {
  const settings = getSettings().fees;
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (key: Parameters<typeof translateIn>[1], vars?: Record<string, string | number>) =>
    translateIn(lang, key, vars);

  const rows = debt.repayments
    .map(
      (r) => `<tr>
        <td>${shortDate(r.paidAt)}</td>
        <td>${escapeHtml(r.method || "—")}</td>
        <td>${escapeHtml(r.reference || "—")}</td>
        <td>${escapeHtml(r.recordedBy || "—")}</td>
        <td class="num">${money(r.amount)}</td>
      </tr>`,
    )
    .join("");

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
<title>${escapeHtml(debt.lender)}</title>
<style>
  ${PRINT_HEADER_CSS}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#fff}
  ${paperCss(paper)}
  .sheet{width:100%;margin:0 auto}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;
    margin:24px 0 10px}
  .meta{font-size:12px;text-align:end;line-height:1.9}
  .meta span{color:#64748b;margin-inline-end:8px}
  .who{display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:14px}
  .who dt{color:#64748b;font-size:12px}
  .who dd{margin:0 0 10px}
  table{width:100%;border-collapse:collapse;margin-top:8px}
  thead th{background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase;
    letter-spacing:.04em;text-align:start;padding:9px 10px;border-bottom:1px solid #e2e8f0}
  tbody td{padding:9px 10px;border-bottom:1px solid #f1f5f9;font-size:13px}
  .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  .totals{margin-top:14px;margin-inline-start:auto;max-width:320px}
  .totals tr td{padding:6px 10px;font-size:13px;border:none}
  .totals tr.due td{font-size:16px;font-weight:700;border-top:2px solid #0f172a}
  .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;
    font-weight:700;letter-spacing:.03em;text-transform:uppercase}
  .pill.open{background:#fef3c7;color:#b45309}
  .pill.settled{background:#dcfce7;color:#15803d}
  .pill.cancelled{background:#e2e8f0;color:#475569}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;
    color:#94a3b8;text-align:center}
</style></head><body>
<div class="sheet">
  ${printHeaderHtml(
    tr("debtsPrint.statementTitle"),
    `<div class="meta"><span>${tr("debtsPrint.lender")}</span><strong>${escapeHtml(debt.lender)}</strong></div>`,
  )}

  <div class="who">
    <div>
      <dt>${tr("debtsPrint.purpose")}</dt>
      <dd>${escapeHtml(debt.purpose || "—")}</dd>
      <dt>${tr("debtsPrint.reference")}</dt>
      <dd>${escapeHtml(debt.reference || "—")}</dd>
    </div>
    <div>
      <dt>${tr("debtsPrint.taken")}</dt>
      <dd>${shortDate(debt.takenAt)}</dd>
      <dt>${tr("debtsPrint.status")}</dt>
      <dd><span class="pill ${debt.status.toLowerCase()}">${tr(`debtsPrint.status${debt.status}` as never)}</span></dd>
    </div>
  </div>

  <h2>${tr("debtsPrint.repaymentHistory")}</h2>
  ${
    debt.repayments.length > 0
      ? `<table>
        <thead><tr>
          <th>${tr("debtsPrint.date")}</th>
          <th>${tr("debtsPrint.method")}</th>
          <th>${tr("debtsPrint.reference")}</th>
          <th>${tr("debtsPrint.recordedBy")}</th>
          <th class="num">${tr("debtsPrint.amountCol")}</th>
        </tr></thead>
        <tbody>${rows}</tbody>
      </table>`
      : `<p style="color:#94a3b8;font-size:13px">${tr("debtsPrint.noRepaymentsYet")}</p>`
  }

  <table class="totals">
    <tr><td>${tr("debtsPrint.principal")}</td><td class="num">${money(debt.principal)}</td></tr>
    <tr><td>${tr("debtsPrint.totalRepaid")}</td><td class="num">${money(debt.repaid)}</td></tr>
    <tr class="due"><td>${tr("debtsPrint.outstanding")}</td><td class="num">${money(debt.outstanding)}</td></tr>
  </table>

  <div class="foot">${escapeHtml(settings.receiptFooter || tr("feesReceiptPrint.defaultFooter"))}</div>
</div>
</body></html>`;
}

export function printDebtStatement(
  debt: SchoolDebtDetail,
  paper: PaperSize = getStoredPaper(),
) {
  const w = window.open("", "_blank", "width=840,height=1000");
  if (!w) return;
  w.document.write(debtStatementHtml(debt, paper));
  w.document.close();
  w.focus();
  w.print();
}
