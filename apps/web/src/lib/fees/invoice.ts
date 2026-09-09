import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { money } from "./format";
import { dirOf } from "@/lib/i18n/config";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import type { StudentPosition } from "./api";
import { schoolBranding } from "@/lib/settings/store";
import {
  accentColour,
  documentFooterHtml,
  letterheadHtml,
  LETTERHEAD_CSS,
  signatureHtml,
  stampHtml,
  watermarkHtml,
} from "@/lib/print/letterhead";
import { getStoredTemplate, type DocTemplate } from "@/lib/print/template";

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
import { getStoredPaper, paperCss, type PaperSize } from "@/lib/print/paper";

export function invoiceNumber(position: StudentPosition, periodKey: string): string {
  const prefix = getSettings().fees.receiptPrefix || "INV";
  const code = position.code.replace(/[^A-Za-z0-9]/g, "").toUpperCase();
  return `${prefix}-${code}-${periodKey.replace("-", "")}`;
}

export function invoiceHtml(
  position: StudentPosition,
  periodKey: string,
  paper: PaperSize = getStoredPaper(),
): string {
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
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a;background:#fff}
  ${paperCss(paper)}
  .sheet{width:100%;margin:0 auto}
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

export function printInvoice(
  position: StudentPosition,
  periodKey: string,
  paper: PaperSize = getStoredPaper(),
) {
  const w = window.open("", "_blank", "width=840,height=1000");
  if (!w) return;
  w.document.write(invoiceDocumentHtml(position, periodKey, paper));
  w.document.close();
  w.focus();
  w.print();
}

/**
 * The same invoice on official school paper.
 *
 * Nothing here computes differently from the invoice above: it takes the same
 * due lines from the same position and totals them the same way. What it adds
 * is the letterhead a family recognises — logo, motto, contact line, watermark,
 * signature rules and the stamp circle — and a due date, which a bill needs and
 * a statement does not.
 *
 * The due date is the last day of the period being billed, derived rather than
 * stored. Putting a settable date on an invoice that has no invoice record
 * behind it would let two prints of the same bill disagree about when it was
 * owed, and a family holding the earlier one would be right.
 */
export function premiumInvoiceHtml(
  position: StudentPosition,
  periodKey: string,
  paper: PaperSize = getStoredPaper(),
): string {
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (
    k: Parameters<typeof translateIn>[1],
    vars?: Record<string, string | number>,
  ) => translateIn(lang, k, vars);

  const settings = getSettings().fees;
  const school = schoolBranding();
  const number = invoiceNumber(position, periodKey);
  const today = new Date().toISOString().slice(0, 10);

  // Day 0 of the next month is the last day of this one.
  const [py, pm] = periodKey.split("-").map(Number);
  const dueBy =
    Number.isFinite(py) && Number.isFinite(pm)
      ? new Date(Date.UTC(py, pm, 0)).toISOString().slice(0, 10)
      : "—";

  // Only what is actually due. A future month on an invoice reads as a demand
  // for money the family does not owe yet.
  const lines = position.lines.filter((l) => l.due && l.status !== "INACTIVE");
  const totalExpected = lines.reduce((n, l) => n + l.expected, 0);
  const totalPaid = lines.reduce((n, l) => n + Math.min(l.paid, l.expected), 0);
  const balance = lines.reduce((n, l) => n + l.outstanding, 0);

  const rows =
    lines.length > 0
      ? lines
          .map(
            (l, i) => `<tr>
              <td class="n">${i + 1}</td>
              <td>${escapeHtml(l.label)}</td>
              <td class="num">${money(l.expected)}</td>
              <td class="num">${money(Math.min(l.paid, l.expected))}</td>
              <td class="num">${money(l.outstanding)}</td>
            </tr>`,
          )
          .join("")
      : `<tr><td colspan="5" class="empty">${tr("feesInvoice.nothingDue")}</td></tr>`;

  const statusKey =
    balance === 0
      ? "feesInvoice.statusPaid"
      : totalPaid > 0
        ? "feesInvoice.statusPartial"
        : "feesInvoice.statusUnpaid";
  const statusColour =
    balance === 0 ? "#16a34a" : totalPaid > 0 ? "#d97706" : "#dc2626";

  const ahead =
    position.advance > 0 || position.credit > 0
      ? `<div class="ahead">
           ${position.advance > 0 ? tr("feesInvoice.paidAhead", { amount: money(position.advance) }) : ""}
           ${position.credit > 0 ? tr("feesInvoice.credit", { amount: money(position.credit) }) : ""}
         </div>`
      : "";

  return `<!doctype html><html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/>
<title>${escapeHtml(number)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
  ${paperCss(paper)}
  ${LETTERHEAD_CSS}
  table.items{width:100%;border-collapse:collapse}
  table.items th{background:#eff6ff;color:#1e3a8a;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.items td{padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9}
  table.items .n{width:32px;color:#94a3b8}
  table.items .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap;width:17%}
  table.items .empty{color:#94a3b8;text-align:center;padding:20px}
  /* The money reads down the end of the page, the way a bill does. */
  .totals{margin-top:12px;margin-inline-start:auto;width:56%;border:1px solid #e2e8f0;
    border-radius:8px;border-collapse:collapse;overflow:hidden}
  .totals td{padding:7px 14px;font-size:12px;border-bottom:1px solid #f1f5f9}
  .totals td:last-child{text-align:end;font-weight:700;
    font-variant-numeric:tabular-nums;white-space:nowrap}
  .totals tr.grand td{background:#eff6ff;font-size:15px;font-weight:800;
    color:#1e3a8a;border-bottom:none}
  .badge{display:inline-block;padding:5px 15px;border-radius:999px;color:#fff;
    font-size:11px;font-weight:800;letter-spacing:.09em;text-transform:uppercase}
  .ahead{margin-top:10px;font-size:11.5px;color:#15803d}
  .notes{margin-top:14px;border:1px solid #e2e8f0;border-radius:8px;padding:10px 14px;
    font-size:10.5px;color:#475569;line-height:1.6}
  @media print{ .doc-watermark{position:absolute} }
</style></head><body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({
    title: tr("feesInvoice.title"),
    refLabel: tr("feesInvoice.invoiceNo"),
    refValue: number,
  })}

  <div class="sec">
    <div class="sec-head">${tr("feesInvoice.billedTo")}</div>
    <div class="grid2">
      <table class="kv">
        <tr><td class="k">${tr("feesInvoice.student")}</td><td class="v">${escapeHtml(position.fullName)}</td></tr>
        <tr><td class="k">${tr("feesInvoice.studentId")}</td><td class="v">${escapeHtml(position.code)}</td></tr>
        <tr><td class="k">${tr("feesInvoice.classSection")}</td><td class="v">${escapeHtml(position.className ?? "—")}${position.section ? " - " + escapeHtml(position.section) : ""}</td></tr>
      </table>
      <table class="kv">
        <tr><td class="k">${tr("feesInvoice.issued")}</td><td class="v">${today}</td></tr>
        <tr><td class="k">${tr("feesInvoice.dueBy")}</td><td class="v">${dueBy}</td></tr>
        <tr><td class="k">${tr("feesInvoice.monthlyFee")}</td><td class="v">${money(position.monthlyFee)}</td></tr>
      </table>
    </div>
  </div>

  <div class="sec">
    <div class="sec-head">${tr("feesInvoice.charges")}</div>
    <table class="items">
      <thead><tr>
        <th class="n">#</th>
        <th>${tr("feesInvoice.description")}</th>
        <th class="num">${tr("feesInvoice.charged")}</th>
        <th class="num">${tr("feesInvoice.paid")}</th>
        <th class="num">${tr("feesInvoice.balance")}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <table class="totals">
    <tr><td>${tr("feesInvoice.charged")}</td><td>${money(totalExpected)}</td></tr>
    <tr><td>${tr("feesInvoice.paid")}</td><td>${money(totalPaid)}</td></tr>
    <tr class="grand"><td>${tr("feesInvoice.amountDue")}</td><td>${money(balance)}</td></tr>
  </table>

  <div style="margin-top:12px;text-align:end">
    <span class="badge" style="background:${statusColour}">${tr(
      statusKey as Parameters<typeof translateIn>[1],
    )}</span>
  </div>
  ${ahead}

  <div class="notes">${escapeHtml(settings.receiptFooter || tr("feesInvoice.defaultFooter"))}</div>

  <div class="signs">
    ${signatureHtml(tr("feesInvoice.financeOffice"))}
    ${stampHtml(tr("feesReceiptPrint.stampLine1"), tr("feesReceiptPrint.stampLine2"))}
    ${signatureHtml(tr("feesReceiptPrint.principal"), school.principalName)}
  </div>

  ${documentFooterHtml()}
</div></body></html>`;
}

/**
 * The invoice in whichever design this school has chosen.
 *
 * One entry point, for the same reason the receipt has one: two desks must not
 * end up printing the school's bills on different paper.
 */
export function invoiceDocumentHtml(
  position: StudentPosition,
  periodKey: string,
  paper: PaperSize = getStoredPaper(),
  template: DocTemplate = getStoredTemplate(),
): string {
  return template === "PREMIUM"
    ? premiumInvoiceHtml(position, periodKey, paper)
    : invoiceHtml(position, periodKey, paper);
}
