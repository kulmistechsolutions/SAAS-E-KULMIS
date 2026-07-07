import type { PaymentMethod, PayrollStatus, Position } from "./types";

export const money = (n: number) => `$${n.toLocaleString()}`;

export function monthKey(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function monthLabel(key: string): string {
  const [y, m] = key.split("-");
  const d = new Date(Number(y), Number(m) - 1, 1);
  return d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
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

export function netSalary(
  basic: number,
  allowances: number,
  bonus: number,
  deductions: number,
): number {
  return Math.max(0, basic + allowances + bonus - deductions);
}

export function payrollStatusLabel(s: PayrollStatus): string {
  return s.charAt(0) + s.slice(1).toLowerCase();
}

export function paymentMethodLabel(m: PaymentMethod): string {
  return m
    .split("_")
    .map((w) => w.charAt(0) + w.slice(1).toLowerCase())
    .join(" ");
}

export function positionLabel(p: Position): string {
  return p;
}

export const POSITIONS: Position[] = [
  "Teacher",
  "Administrator",
  "Finance Officer",
  "Attendance Officer",
  "Receptionist",
  "Security Staff",
  "Cleaner",
  "Other Staff",
];

export const PAYMENT_METHODS: PaymentMethod[] = [
  "CASH",
  "BANK_TRANSFER",
  "MOBILE_MONEY",
  "CHEQUE",
];
