import { getStoredLang, translateIn } from "@/lib/i18n/provider";
import { formatMoney } from "@/lib/settings/currency";

export const money = (n: number) => formatMoney(n, { decimals: 0 });

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

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const genderLabel = (g: string) =>
  translateIn(getStoredLang(), g === "MALE" ? "students.male" : "students.female");

const STATUS_KEYS: Record<string, Parameters<typeof translateIn>[1]> = {
  ACTIVE: "students.active",
  INACTIVE: "students.inactive",
  GRADUATED: "students.graduated",
  PRESENT: "students.present",
  ABSENT: "students.absent",
  LATE: "students.late",
};

/** Falls back to a plain capitalized string for statuses outside the
 *  student lifecycle (e.g. attendance's PRESENT/ABSENT/LATE) that have no
 *  translation key of their own here. */
export const statusLabel = (s: string) => {
  const key = STATUS_KEYS[s];
  return key ? translateIn(getStoredLang(), key) : s.charAt(0) + s.slice(1).toLowerCase();
};
