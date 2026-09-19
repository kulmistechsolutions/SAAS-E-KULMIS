import type { PayrollRow } from "./types";

/**
 * The same person, on one month, more than once.
 *
 * NUURULYAQIIN paid Kaamil for August under a name carrying no staff id, then
 * registered him as an employee in September; Generate Payroll matched on ids
 * alone and put him on August a second time. The month read $3,380 against a
 * real $2,930 and nothing on the screen said why — the school had to notice
 * a repeated name in a list of twelve and work the arithmetic out themselves.
 *
 * Generate cannot do it again, but a month that already has one stays wrong
 * until somebody removes the extra row. So the screen says so, names the
 * person, and says what the total would be without it.
 *
 * Matched on the trimmed, case-folded name, which is what a duplicate looks
 * like: the ids are exactly what the two rows disagree about.
 */
export function duplicatePeople(
  rows: PayrollRow[],
): { name: string; rows: PayrollRow[]; extra: number }[] {
  const byName = new Map<string, PayrollRow[]>();
  for (const r of rows) {
    const key = r.employeeName.trim().toLowerCase().replace(/\s+/g, " ");
    if (!key) continue;
    const list = byName.get(key);
    if (list) list.push(r);
    else byName.set(key, [r]);
  }
  return [...byName.values()]
    .filter((list) => list.length > 1)
    .map((list) => ({
      name: list[0]!.employeeName,
      rows: list,
      // What the month is overstated by: everything past the first row.
      extra: list
        .slice(1)
        .reduce((sum, r) => sum + r.netSalary, 0),
    }));
}
