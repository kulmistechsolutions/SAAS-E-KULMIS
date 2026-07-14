const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

export const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const moneyPlain = (n: number) => `$${n.toLocaleString()}`;

export function monthKey(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export function parseMonthKey(key: string): { year: number; month: number } {
  const [y, m] = key.split("-").map(Number);
  return { year: y, month: m };
}

export function monthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month - 1]} - ${year}`;
}

export function shortMonthLabel(key: string): string {
  const { year, month } = parseMonthKey(key);
  return `${MONTH_NAMES[month - 1].slice(0, 3)} ${year}`;
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
  if (t === "THIS_MONTH") return "This Month";
  if (t === "PARTIAL") return "Partial Payment";
  if (t === "ADVANCE") return `Advance (${advanceMonths ?? 1} Month${(advanceMonths ?? 1) > 1 ? "s" : ""})`;
  return t;
}

export function feeStatusLabel(
  status: string,
  advanceMonthsLeft?: number,
): string {
  if (status === "ADVANCE_MULTI" && advanceMonthsLeft)
    return `Advance (${advanceMonthsLeft})`;
  if (status === "ADVANCE") return "Advance";
  if (status === "INACTIVE") return "Inactive";
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
