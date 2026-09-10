import { getSettings } from "@/lib/settings/store";
import { PRINT_HEADER_CSS, printHeaderHtml } from "@/lib/print/header";
import { getState as getStudentsState } from "@/lib/students/store";
import { feeStatusLabel, monthLabel, money, paymentTypeLabel, receiptDate } from "./format";
import type { ClassFeeSummary, FeePayment, StudentFeeRow } from "./types";
import { outstandingBalance } from "./store";
import { dirOf } from "@/lib/i18n/config";
import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import { csvCell, csvRow } from "@ekulmis/shared";
import { getStoredPaper, paperCss, type PaperSize } from "@/lib/print/paper";
import { getStoredTemplate, type DocTemplate } from "@/lib/print/template";
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

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function receiptHtml(
  payment: FeePayment,
  paper: PaperSize = getStoredPaper(),
): string {
  const { receiptHeader, receiptFooter } = getSettings().fees;
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);
  const months = payment.monthKeys.map(monthLabel).join(", ");
  const outstanding = student
    ? outstandingBalance(student.id)
    : payment.outstandingAfter;

  // Print windows have no React tree to pull useT() from — read the same
  // language the rest of the app is showing straight off the cookie, so a
  // printed receipt matches whatever language is active, not always English.
  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);

  // Name every charge this money settled. "Month(s): August 2026" beside a
  // type of "Partial" could not tell a family whether they had paid August's
  // tuition or the one-off admission fee — the two read identically.
  const paidLines =
    payment.lines && payment.lines.length > 0
      ? payment.lines
      : [{ label: months || tr("feesReceiptPrint.feeReceiptDefault"), amount: payment.amount }];

  const paidFor =
    paidLines.length > 0
      ? `<table class="lines">
          <thead><tr>
            <th>${tr("feesReceiptPrint.paidFor")}</th>
            <th class="num">${tr("feesReceiptPrint.amountCol")}</th>
          </tr></thead>
          <tbody>${paidLines
            .map(
              (l) =>
                `<tr><td>${escapeHtml(l.label)}</td><td class="num">${money(l.amount)}</td></tr>`,
            )
            .join("")}</tbody>
          <tfoot><tr>
            <td>${tr("feesReceiptPrint.totalPaid")}</td>
            <td class="num">${money(payment.amount)}</td>
          </tr></tfoot>
        </table>`
      : "";

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${payment.receiptNo}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,sans-serif;color:#0f172a}
  ${paperCss(paper)}
  ${PRINT_HEADER_CSS}
  .receipt-no{font-size:14px;color:#64748b}
  .receipt-no strong{display:block;font-size:20px;color:#0f172a}
  table{width:100%;border-collapse:collapse;margin:20px 0}
  th,td{text-align:start;padding:10px 12px;border-bottom:1px solid #e2e8f0;font-size:14px}
  th{width:40%;color:#64748b;font-weight:500}
  .amount{font-size:28px;font-weight:700;color:#16a34a;text-align:center;margin:24px 0}
  /* What the money settled, itemised. A single total told a family nothing
     about which debt was cleared; each line names its own. */
  table.lines{margin:20px 0;border:1px solid #e2e8f0;border-radius:8px}
  table.lines thead th{background:#f8fafc;color:#475569;font-weight:600;font-size:12px;
    text-transform:uppercase;letter-spacing:.04em;width:auto}
  table.lines td{font-size:14px}
  table.lines .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap}
  table.lines tfoot td{font-weight:700;background:#f8fafc;border-bottom:none}
  .foot{margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8;text-align:center}
</style></head><body>
  ${printHeaderHtml(
    receiptHeader || tr("feesReceiptPrint.feeReceiptDefault"),
    `<div class="receipt-no">${tr("feesReceiptPrint.receiptNo")}<strong>${payment.receiptNo}</strong></div>`,
  )}
  <table>
    <tr><th>${tr("feesReceiptPrint.studentName")}</th><td>${student?.fullName ?? "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.studentId")}</th><td>${student?.code ?? "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.paymentType")}</th><td>${paymentTypeLabel(payment.paymentType, payment.advanceMonths)}</td></tr>
    <tr><th>${tr("feesReceiptPrint.monthS")}</th><td>${months || "—"}</td></tr>
    <tr><th>${tr("feesReceiptPrint.collectedBy")}</th><td>${payment.collectedBy}</td></tr>
    <tr><th>${tr("feesReceiptPrint.collectionDate")}</th><td>${receiptDate(payment.collectedAt)}</td></tr>
    <tr><th>${tr("feesReceiptPrint.outstandingBalance")}</th><td>${money(outstanding)}</td></tr>
  </table>
  ${paidFor}
  <div class="amount">${tr("feesReceiptPrint.amountPaid")} ${money(payment.amount)}</div>
  <div class="foot">${receiptFooter || tr("feesReceiptPrint.defaultFooter")}</div>
</body></html>`;
}

/**
 * The receipt in whichever design this school has chosen.
 *
 * One entry point so every caller — the payment dialog, the history page, a
 * reprint — cannot end up on a different template from each other. The choice
 * only picks the layout; both templates are handed the identical payment.
 */
export function receiptDocumentHtml(
  payment: FeePayment,
  paper: PaperSize = getStoredPaper(),
  template: DocTemplate = getStoredTemplate(),
): string {
  return template === "PREMIUM"
    ? premiumReceiptHtml(payment, paper)
    : receiptHtml(payment, paper);
}

export function printReceipt(
  payment: FeePayment,
  paper: PaperSize = getStoredPaper(),
  template: DocTemplate = getStoredTemplate(),
) {
  const w = window.open("", "_blank", "width=800,height=900");
  if (!w) return;
  w.document.write(receiptDocumentHtml(payment, paper, template));
  w.document.close();
  w.focus();
  w.print();
}

export function exportPaymentsCsv(payments: FeePayment[]) {
  const students = getStudentsState().students;
  const header =
    "Receipt No,Student ID,Student Name,Class,Section,Amount,Payment Type,Collected By,Date\n";
  const rows = payments
    .map((p) => {
      const st = students.find((s) => s.id === p.studentId);
      return [
        p.receiptNo,
        st?.code ?? "",
        `"${st?.fullName ?? ""}"`,
        st?.className ?? "",
        st?.section ?? "",
        p.amount,
        paymentTypeLabel(p.paymentType, p.advanceMonths),
        p.collectedBy,
        p.collectedAt.slice(0, 10),
      ].join(",");
    })
    .join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "fee-payments.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export function printClassFeeSummaries(
  summaries: ClassFeeSummary[],
  meta: { academicYear: string; monthLabel: string },
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const lang = getStoredLang();
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);
  const body = summaries
    .map(
      (c) => `<tr>
        <td>${escapeHtml(c.className)}</td>
        <td>${c.totalStudents}</td>
        <td>${money(c.outstandingAmount)}</td>
        <td>${c.paidStudents}</td>
        <td>${c.advanceStudents}</td>
        <td>${c.partialStudents}</td>
        <td>${c.freeStudents}</td>
      </tr>`,
    )
    .join("");
  const totals = summaries.reduce(
    (acc, c) => ({
      students: acc.students + c.totalStudents,
      outstanding: acc.outstanding + c.outstandingAmount,
      paid: acc.paid + c.paidStudents,
      advance: acc.advance + c.advanceStudents,
      partial: acc.partial + c.partialStudents,
      free: acc.free + c.freeStudents,
    }),
    { students: 0, outstanding: 0, paid: 0, advance: 0, partial: 0, free: 0 },
  );
  w.document.write(`<!DOCTYPE html><html><head><title>${tr("feesClassFeeSummary.title")}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    tfoot td{font-weight:700;background:#f8fafc}
    @media print{body{padding:0}}
  </style></head><body>
  ${printHeaderHtml(`${tr("feesClassFeeSummary.title")} · ${escapeHtml(meta.academicYear)} · ${escapeHtml(meta.monthLabel)}`)}
  <table>
    <thead><tr>
      <th>${tr("feesClassFeeSummary.class")}</th>
      <th>${tr("feesClassFeeSummary.totalStudents")}</th>
      <th>${tr("feesClassFeeSummary.outstanding")}</th>
      <th>${tr("feesClassFeeSummary.paid")}</th>
      <th>${tr("feesClassFeeSummary.advance")}</th>
      <th>${tr("feesClassFeeSummary.partial")}</th>
      <th>${tr("feesClassFeeSummary.free")}</th>
    </tr></thead>
    <tbody>${body || '<tr><td colspan="7">No classes</td></tr>'}</tbody>
    <tfoot><tr>
      <td>${tr("feesClassFeeSummary.total")}</td>
      <td>${totals.students}</td>
      <td>${money(totals.outstanding)}</td>
      <td>${totals.paid}</td>
      <td>${totals.advance}</td>
      <td>${totals.partial}</td>
      <td>${totals.free}</td>
    </tr></tfoot>
  </table>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

export function printClassCollectionList(
  rows: StudentFeeRow[],
  meta: { academicYear: string; monthLabel: string; className: string; section: string; status: string },
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const lang = getStoredLang();
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);
  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.code)}</td>
        <td>${escapeHtml(r.fullName)}</td>
        <td>${escapeHtml(r.className)}${r.section && r.section !== "—" ? " - " + escapeHtml(r.section) : ""}</td>
        <td>${money(r.monthlyFee)}</td>
        <td>${money(r.outstandingBalance)}</td>
        <td>${feeStatusLabel(r.status, r.advanceMonthsLeft)}</td>
      </tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>${tr("feesClassFeeSummary.collectionListTitle")}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  ${printHeaderHtml(`${tr("feesClassFeeSummary.collectionListTitle")} · ${escapeHtml(meta.academicYear)} · ${escapeHtml(meta.monthLabel)} · ${escapeHtml(meta.className)}${meta.section ? " - " + escapeHtml(meta.section) : ""} · ${escapeHtml(meta.status)}`)}
  <table>
    <thead><tr>
      <th>#</th>
      <th>${tr("feesCollectFeesSection.studentId")}</th>
      <th>${tr("feesCollectFeesSection.studentName")}</th>
      <th>${tr("feesCollectFeesSection.class")}</th>
      <th>${tr("feesCollectFeesSection.monthlyFee")}</th>
      <th>${tr("feesCollectFeesSection.outstandingBalance")}</th>
      <th>${tr("feesCollectFeesSection.status")}</th>
    </tr></thead>
    <tbody>${body || `<tr><td colspan="7">${tr("feesCollectFeesSection.noStudentsMatchYourFilters")}</td></tr>`}</tbody>
  </table>
  <div class="foot">Total: ${rows.length} · Generated ${new Date().toLocaleString()}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

/** One row of a dashboard drill-down, already shaped by the dialog. */
export interface BreakdownRow {
  /** Left column: a student's name, or a receipt number. */
  primary: string;
  /** Second column: their class, or the student a payment was for. */
  secondary: string;
  /** Money columns, in the order the dialog shows them. */
  amounts: number[];
}

export interface BreakdownMeta {
  /** What was clicked — "Still owed for", "Collected in". */
  title: string;
  /** Every filter that was active, already worded: year, month, class, status. */
  context: string;
  /** Column headings for `amounts`. */
  amountHeadings: string[];
  /** Heading for `secondary`. */
  secondaryHeading: string;
  primaryHeading: string;
  /** The figure the card showed, so paper and screen can be compared. */
  total?: number;
}

/**
 * Print exactly the rows on screen, headed by exactly the filters that chose
 * them.
 *
 * A printed financial list with no statement of what it was filtered to is
 * worse than no list: it will be read months later as the whole school's
 * position for the whole year. So the filter line is not decoration here — it
 * is the part that makes the paper true, and it is built from the same state
 * the rows were.
 */
export function printFeeBreakdown(rows: BreakdownRow[], meta: BreakdownMeta) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const lang = getStoredLang();
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);

  const body = rows
    .map(
      (r, i) => `<tr>
        <td>${i + 1}</td>
        <td>${escapeHtml(r.primary)}</td>
        <td>${escapeHtml(r.secondary)}</td>
        ${r.amounts.map((a) => `<td class="num">${money(a)}</td>`).join("")}
      </tr>`,
    )
    .join("");

  const cols = 3 + meta.amountHeadings.length;
  w.document.write(`<!DOCTYPE html><html><head><title>${escapeHtml(meta.title)}</title>
  <style>
    *{font-family:Arial,Helvetica,sans-serif;box-sizing:border-box}
    body{padding:32px;color:#0f172a}
    ${PRINT_HEADER_CSS}
    table{width:100%;border-collapse:collapse;margin-top:8px;font-size:13px}
    th,td{border:1px solid #cbd5e1;padding:7px 10px;text-align:left}
    th{background:#f1f5f9}
    .num{text-align:right;font-variant-numeric:tabular-nums}
    tfoot td{font-weight:bold;background:#f8fafc}
    .foot{margin-top:24px;font-size:11px;color:#94a3b8}
    @media print{body{padding:0}}
  </style></head><body>
  ${printHeaderHtml(`${escapeHtml(meta.title)} · ${escapeHtml(meta.context)}`)}
  <table>
    <thead><tr>
      <th>#</th>
      <th>${escapeHtml(meta.primaryHeading)}</th>
      <th>${escapeHtml(meta.secondaryHeading)}</th>
      ${meta.amountHeadings.map((h) => `<th class="num">${escapeHtml(h)}</th>`).join("")}
    </tr></thead>
    <tbody>${
      body ||
      `<tr><td colspan="${cols}">${tr("feesMetricBreakdown.nothingToShow")}</td></tr>`
    }</tbody>
    ${
      meta.total === undefined
        ? ""
        : `<tfoot><tr><td colspan="${cols - 1}">${tr(
            "feesMetricBreakdown.total",
          )}</td><td class="num">${money(meta.total)}</td></tr></tfoot>`
    }
  </table>
  <div class="foot">${rows.length} · ${new Date().toLocaleString()}</div>
  <script>window.onload=function(){window.print()}</script>
  </body></html>`);
  w.document.close();
}

/** The same rows and the same filter line, as a spreadsheet. */
export function exportFeeBreakdownCsv(rows: BreakdownRow[], meta: BreakdownMeta) {
  const q = (v: string) => csvCell(v);
  // The filter line rides in the file, not only in its name: a downloaded CSV
  // gets renamed, mailed on, and opened by someone who never saw this screen.
  const lines = [
    q(`${meta.title} — ${meta.context}`),
    "",
    ["#", meta.primaryHeading, meta.secondaryHeading, ...meta.amountHeadings]
      .map(q)
      .join(","),
    ...rows.map((r, i) => csvRow([i + 1, r.primary, r.secondary, ...r.amounts])),
  ];
  if (meta.total !== undefined) {
    lines.push("", csvRow(["Total", "", "", meta.total]));
  }

  const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${meta.title} ${meta.context}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) + ".csv";
  a.click();
  URL.revokeObjectURL(url);
}

/**
 * The receipt on official school paper.
 *
 * Same payment, same balances, same source of truth — this file computes
 * nothing. What changes is that the school's own letterhead, motto, contact
 * details, watermark, signature lines and stamp area appear, which is what
 * separates a printout from a document a family keeps.
 *
 * The status band is the part that earns its place: a reversed payment must
 * say so across the page. A cancelled receipt that still looks valid is worse
 * than no receipt, because it will be produced later as proof of a payment the
 * school has already given back.
 */
export function premiumReceiptHtml(
  payment: FeePayment,
  paper: PaperSize = getStoredPaper(),
): string {
  const { receiptHeader, receiptFooter } = getSettings().fees;
  const student = getStudentsState().students.find((s) => s.id === payment.studentId);
  const months = payment.monthKeys.map(monthLabel).join(", ");
  const outstanding = student
    ? outstandingBalance(student.id)
    : payment.outstandingAfter;

  const lang = getStoredLang();
  const dir = dirOf(lang);
  const tr = (key: Parameters<typeof translateIn>[1]) => translateIn(lang, key);
  const school = schoolBranding();

  const lines =
    payment.lines && payment.lines.length > 0
      ? payment.lines
      : [{ label: months || tr("feesReceiptPrint.feeReceiptDefault"), amount: payment.amount }];

  const rows = lines
    .map(
      (l, i) =>
        `<tr><td class="n">${i + 1}</td><td>${escapeHtml(l.label)}</td>
         <td class="num">${money(l.amount)}</td></tr>`,
    )
    .join("");

  const reversed = payment.status === "REVERSED" || payment.isReversal;

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}"><head><meta charset="utf-8"/><title>${escapeHtml(payment.receiptNo)}</title>
<style>
  *{box-sizing:border-box;margin:0;padding:0}
  body{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;color:#0f172a}
  ${paperCss(paper)}
  ${LETTERHEAD_CSS}
  table.items{width:100%;border-collapse:collapse;margin:0}
  table.items th{background:#eff6ff;color:#1e3a8a;font-size:10px;font-weight:700;
    text-transform:uppercase;letter-spacing:.05em;padding:8px 12px;text-align:start;
    border-bottom:1px solid #dbeafe}
  table.items td{padding:8px 12px;font-size:12px;border-bottom:1px solid #f1f5f9}
  table.items .n{width:34px;color:#94a3b8}
  table.items .num{text-align:end;font-variant-numeric:tabular-nums;white-space:nowrap;
    width:34%;font-weight:600}
  table.items tfoot td{background:#f8fafc;font-weight:800;font-size:13px;border-bottom:none}
  .words{margin-top:9px;font-size:10.5px;color:#475569;font-style:italic}
  .balance{margin-top:12px;display:flex;gap:10px}
  .balance div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:9px 13px}
  .balance .lbl{font-size:9.5px;color:#64748b;text-transform:uppercase;letter-spacing:.05em}
  .balance .val{font-size:16px;font-weight:800;margin-top:2px;font-variant-numeric:tabular-nums}
  .balance .paid .val{color:#16a34a}
  .balance .due .val{color:#dc2626}
  /* A reversed receipt has to say so from across a desk. */
  .void{margin-top:12px;border:2px solid #dc2626;border-radius:8px;padding:9px 14px;
    text-align:center;color:#dc2626;font-weight:800;letter-spacing:.14em;font-size:15px}
  @media print{ .doc-watermark{position:absolute} }
</style></head><body>
<div class="doc" style="--ek-accent:${accentColour()}">
  ${watermarkHtml()}
  ${letterheadHtml({
    title: receiptHeader || tr("feesReceiptPrint.feeReceiptDefault"),
    subtitle: tr("feesReceiptPrint.receiptSubtitle"),
    refLabel: tr("feesReceiptPrint.receiptNo"),
    refValue: payment.receiptNo,
  })}

  ${reversed ? `<div class="void">${tr("feesReceiptPrint.reversed")}</div>` : ""}

  <div class="sec">
    <div class="sec-head">${tr("feesReceiptPrint.studentInformation")}</div>
    <div class="grid2">
      <table class="kv">
        <tr><td class="k">${tr("feesReceiptPrint.studentName")}</td><td class="v">${escapeHtml(student?.fullName ?? "—")}</td></tr>
        <tr><td class="k">${tr("feesReceiptPrint.studentId")}</td><td class="v">${escapeHtml(student?.code ?? "—")}</td></tr>
      </table>
      <table class="kv">
        <tr><td class="k">${tr("feesReceiptPrint.collectionDate")}</td><td class="v">${escapeHtml(receiptDate(payment.collectedAt))}</td></tr>
        <tr><td class="k">${tr("feesReceiptPrint.academicYear")}</td><td class="v">${escapeHtml(payment.academicYear || "—")}</td></tr>
        <tr><td class="k">${tr("feesReceiptPrint.collectedBy")}</td><td class="v">${escapeHtml(payment.collectedBy)}</td></tr>
      </table>
    </div>
  </div>

  <div class="sec">
    <div class="sec-head">${tr("feesReceiptPrint.paymentDetails")}</div>
    <table class="items">
      <thead><tr>
        <th class="n">#</th>
        <th>${tr("feesReceiptPrint.paidFor")}</th>
        <th class="num">${tr("feesReceiptPrint.amountCol")}</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td class="n"></td>
        <td>${tr("feesReceiptPrint.totalPaid")}</td>
        <td class="num">${money(payment.amount)}</td>
      </tr></tfoot>
    </table>
  </div>

  <div class="balance">
    <div class="paid">
      <div class="lbl">${tr("feesReceiptPrint.amountPaid")}</div>
      <div class="val">${money(payment.amount)}</div>
    </div>
    <div>
      <div class="lbl">${tr("feesReceiptPrint.paymentType")}</div>
      <div class="val" style="font-size:13px">${escapeHtml(paymentTypeLabel(payment.paymentType, payment.advanceMonths))}</div>
    </div>
    <div class="due">
      <div class="lbl">${tr("feesReceiptPrint.outstandingBalance")}</div>
      <div class="val">${money(outstanding)}</div>
    </div>
  </div>

  <div class="signs">
    ${signatureHtml(tr("feesReceiptPrint.collectedBy"), payment.collectedBy)}
    ${stampHtml(tr("feesReceiptPrint.stampLine1"), tr("feesReceiptPrint.stampLine2"))}
    ${signatureHtml(tr("feesReceiptPrint.principal"), school.principalName)}
  </div>

  ${documentFooterHtml(receiptFooter || undefined)}
</div>
</body></html>`;
}
