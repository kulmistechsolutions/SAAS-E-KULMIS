import type { PromotionType } from "./types";

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

export function dateTime(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export const money = (n: number) => `$${n.toLocaleString()}`;

export function promotionTypeLabel(t: PromotionType): string {
  switch (t) {
    case "INDIVIDUAL":
      return "Individual";
    case "CLASS":
      return "Class";
    case "SCHOOL_WIDE":
      return "School-Wide";
  }
}

/** Next class in the standard "Grade N" ladder. Returns null when final class. */
export function nextClassName(
  className: string,
  orderedClasses: string[],
): string | null {
  const idx = orderedClasses.indexOf(className);
  if (idx === -1) return null;
  if (idx >= orderedClasses.length - 1) return null;
  return orderedClasses[idx + 1];
}

/** True when the class is the final class in the ladder (graduation). */
export function isFinalClass(
  className: string,
  orderedClasses: string[],
): boolean {
  const idx = orderedClasses.indexOf(className);
  return idx !== -1 && idx === orderedClasses.length - 1;
}
