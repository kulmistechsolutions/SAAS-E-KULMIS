import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/settings/currency";

const MONTH_KEYS = [
  "feesFormat.month1",
  "feesFormat.month2",
  "feesFormat.month3",
  "feesFormat.month4",
  "feesFormat.month5",
  "feesFormat.month6",
  "feesFormat.month7",
  "feesFormat.month8",
  "feesFormat.month9",
  "feesFormat.month10",
  "feesFormat.month11",
  "feesFormat.month12",
] as const satisfies readonly Parameters<typeof translateIn>[1][];

/** Full precision — receipts, ledgers, anywhere the exact amount matters. */
export const money = (n: number) => formatMoney(n);

/** Rounded, for compact listings and summary tiles. */
export const moneyPlain = (n: number) => formatMoney(n, { decimals: 0 });

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${translateIn(getStoredLang(), MONTH_KEYS[month - 1]!)} - ${year}`;
}

export function shortMonthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${translateIn(getStoredLang(), MONTH_KEYS[month - 1]!).slice(0, 3)} ${year}`;
}

export function nextMonthKey(key: string): string {
  const { year, month } = parseMonthKey(key);
  if (month === 12) return monthKey(year + 1, 1);
  return monthKey(year, month + 1);
}

export function addMonths(key: string, count: number): string {
  let k = key;
  for (let i = 0; i < count; i++) k = nextMonthKey(k);
  return k;
}

export function monthsBetween(from: string, to: string): string[] {
  const out: string[] = [];
  let cur = from;
  while (cur <= to) {
    out.push(cur);
    if (cur === to) break;
    cur = nextMonthKey(cur);
  }
  return out;
}

export function paymentTypeLabel(t: string, advanceMonths?: number): string {
  const lang = getStoredLang();
  if (t === "THIS_MONTH") return translateIn(lang, "feesFormat.thisMonth");
  if (t === "PARTIAL") return translateIn(lang, "feesFormat.partialPayment");
  if (t === "ADVANCE") return `${translateIn(lang, "feesFormat.advance")} (${advanceMonths ?? 1})`;
  return t;
}

export function feeStatusLabel(
  status: string,
  advanceMonthsLeft?: number,
): string {
  const lang = getStoredLang();
  if (status === "ADVANCE_MULTI" && advanceMonthsLeft)
    return `${translateIn(lang, "feesFormat.advance")} (${advanceMonthsLeft})`;
  if (status === "ADVANCE") return translateIn(lang, "feesFormat.advance");
  if (status === "INACTIVE") return translateIn(lang, "feesFormat.inactive");
  if (status === "FREE") return translateIn(lang, "feesFormat.free");
  if (status === "PAID") return translateIn(lang, "feesFormat.paid");
  if (status === "UNPAID") return translateIn(lang, "feesFormat.unpaid");
  if (status === "PARTIAL") return translateIn(lang, "feesFormat.partial");
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function receiptDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
