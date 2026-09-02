import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { money } from "./format";
import { dirOf } from "@/lib/i18n/config";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import type { StudentPosition } from "./api";

/**
 * A school invoice, rendered from the ledger.
 *
 * Deliberately not a stored document with its own copy of the amounts. An
 * invoice that keeps its own totals is wrong the moment the next payment
 * lands, and then a family holds a piece of paper the system disagrees with —
 * which is the whole class of problem this module has been climbing out of.
 * The number is derived from the student and the period, so reprinting the
 * same invoice gives the same number, and every figure on it comes from the
 * engine at the moment of printing.
 */

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Stable for a student and period — a reprint is the same invoice, not a new one. */
export function invoiceNumber(position: StudentPosition, periodKey: string): string {
  const prefix = getSettings().fees.receiptPrefix || "INV";
  const code = position.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${prefix}-${code}-${periodKey.replace("-", "")}`;
}

export function invoiceHtml(position: StudentPosition, periodKey: string): string {
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (k: Parameters<typeof translateIn>[1], vars?: Record<string, string | number>) =>
    translateIn(lang, k, vars);

  const settings = getSettings().fees;
  const number = invoiceNumber(position, periodKey);
  const issued = new Date().toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // Only what is actually due. A future month on an invoice reads as a demand
  // for money the family does not owe yet.
  const due = position.lines.filter((l) => l.due && l.status !== "INACTIVE");
  const totalExpected = due.reduce((n, l) => n + l.expected, 0);
  const totalPaid = due.reduce((n, l) => n + Math.min(l.paid, l.expected), 0);
  const balance = due.reduce((n, l) => n + l.outstanding, 0);

  const rows = due
    .map(
      (l) => `<tr>
        <td>${escapeHtml(l.label)}</td>
        <td class="num">${money(l.expected)}</td>
        <td class="num">${money(Math.min(l.paid, l.expected))}</td>
        <td class="num ${l.outstanding > 0 ? "owed" : ""}">${money(l.outstanding)}</td>
      </tr>`,
    )
    .join("");

  const status =
    balance === 0
      ? `<span class="pill paid">${tr("feesInvoice.statusPaid")}</span>`
      : totalPaid > 0
        ? `<span class="pill part">${tr("feesInvoice.statusPartial")}</span>`
        : `<span class="pill unpaid">${tr("feesInvoice.statusUnpaid")}</span>`;

  const side = `
    <div class="meta">
      <div><span>${tr("feesInvoice.invoiceNo")}</span><b>${escapeHtml(number)}</b></div>
      <div><span>${tr("feesInvoice.issued")}</span><b>${escapeHtml(issued)}</b></div>
      <div>${status}</div>
    </div>`;

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
<title>${escapeHtml(number)}</title>
<style>
  ${PRINT_HEADER_CSS}
  *{box-sizing:border-box}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;margin:0;padding:32px;
    color:#0f172a;background:#fff}
  .sheet{max-width:760px;margin:0 auto}
  .meta{font-size:12px;text-align:end;line-height:1.9}
  .meta span{color:#64748b;margin-inline-end:8px}
  .pill{display:inline-block;padding:2px 10px;border-radius:999px;font-size:11px;
    font-weight:700;letter-spacing:.03em;text-transform:uppercase}
  .pill.paid{background:#dcfce7;color:#15803d}
  .pill.part{background:#fef3c7;color:#b45309}
  .pill.unpaid{background:#fee2e2;color:#b91c1c}
  h2{font-size:13px;text-transform:uppercase;letter-spacing:.06em;color:#64748b;
    margin:28px 0 10px}
  .who{display:grid;grid-template-columns:1fr 1fr;gap:24px;font-size:14px}
  .who dt{color:#64748b;font-size:12px}
  .who dd{margin:2px 0 10px;font-weight:600}
  table{width:100%;border-collapse:collapse}
  thead th{background:#f8fafc;color:#475569;font-size:11px;text-transform:uppercase;
    letter-spacing:.05em;text-align:start;padding:10px 12px;border-bottom:1px solid #e2e8f0}
  tbody td{padding:11px 12px;border-bottom:1px solid #f1f5f9;font-size:14px}
  .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  .owed{color:#b91c1c;font-weight:600}
  tfoot td{padding:11px 12px;font-size:14px;font-weight:700;background:#f8fafc}
  tfoot tr.total td{font-size:16px;border-top:2px solid #0f172a}
  .foot{margin-top:36px;padding-top:14px;border-top:1px solid #e2e8f0;
    font-size:11px;color:#64748b;text-align:center;line-height:1.7}
  @media print{body{padding:0}.sheet{max-width:none}}
</style></head><body><div class="sheet">
  ${printHeaderHtml(tr("feesInvoice.title"), side)}

  <h2>${tr("feesInvoice.billedTo")}</h2>
  <dl class="who">
    <div>
      <dt>${tr("feesInvoice.student")}</dt><dd>${escapeHtml(position.fullName)}</dd>
      <dt>${tr("feesInvoice.studentId")}</dt><dd>${escapeHtml(position.code)}</dd>
    </div>
    <div>
      <dt>${tr("feesInvoice.classSection")}</dt>
      <dd>${escapeHtml(position.className ?? "—")}${position.section ? ` · ${escapeHtml(position.section)}` : ""}</dd>
      <dt>${tr("feesInvoice.monthlyFee")}</dt><dd>${money(position.monthlyFee)}</dd>
    </div>
  </dl>

  <h2>${tr("feesInvoice.charges")}</h2>
  <table>
    <thead><tr>
      <th>${tr("feesInvoice.description")}</th>
      <th class="num">${tr("feesInvoice.charged")}</th>
      <th class="num">${tr("feesInvoice.paid")}</th>
      <th class="num">${tr("feesInvoice.balance")}</th>
    </tr></thead>
    <tbody>${rows || `<tr><td colspan="4">${tr("feesInvoice.nothingDue")}</td></tr>`}</tbody>
    <tfoot>
      <tr>
        <td>${tr("feesInvoice.totals")}</td>
        <td class="num">${money(totalExpected)}</td>
        <td class="num">${money(totalPaid)}</td>
        <td class="num">${money(balance)}</td>
      </tr>
      <tr class="total">
        <td colspan="3">${tr("feesInvoice.amountDue")}</td>
        <td class="num">${money(balance)}</td>
      </tr>
    </tfoot>
  </table>

  ${
    position.advance > 0 || position.credit > 0
      ? `<p style="margin-top:16px;font-size:13px;color:#15803d">
           ${position.advance > 0 ? tr("feesInvoice.paidAhead", { amount: money(position.advance) }) : ""}
           ${position.credit > 0 ? tr("feesInvoice.credit", { amount: money(position.credit) }) : ""}
         </p>`
      : ""
  }

  <div class="foot">${escapeHtml(settings.receiptFooter || tr("feesInvoice.defaultFooter"))}</div>
</div></body></html>`;
}

export function printInvoice(position: StudentPosition, periodKey: string) {
  const w = window.open("", "_blank", "width=840,height=1000");
  if (!w) return;
  w.document.write(invoiceHtml(position, periodKey));
  w.document.close();
  w.focus();
  w.print();
}
