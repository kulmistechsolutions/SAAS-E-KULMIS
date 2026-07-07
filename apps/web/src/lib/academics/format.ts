export const statusLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase();

export const money = (n: number) => `$${n.toLocaleString()}`;

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

export function percent(n: number): string {
  return `${n.toFixed(1)}%`;
}
