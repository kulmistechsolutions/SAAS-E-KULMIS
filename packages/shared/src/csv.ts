/**
 * Turning rows into a CSV a spreadsheet will open without changing them.
 *
 * Two things go wrong here and both are silent. A cell containing a comma or a
 * quote splits a row into the wrong number of columns, and a cell beginning
 * `=`, `+`, `-` or `@` is a formula to Excel — so a student named by a school
 * that started the field with a dash arrives as a calculation, or worse, as
 * something a spreadsheet offers to run.
 *
 * Kept here rather than beside the one screen that first needed it, because
 * every export the product grows will need the same two answers, and the
 * second one is not obvious enough to be re-derived correctly each time.
 */

/** True for text a spreadsheet would treat as a formula rather than a value. */
export function looksLikeFormula(value: string): boolean {
  return /^[=+\-@\t\r]/.test(value);
}

/** One CSV cell: always quoted, never executable. */
export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '""';
  if (typeof value === "number") return String(value);
  // The leading apostrophe is how a spreadsheet is told "this is text". It is
  // not shown in the cell, and it is the only guard that survives the file
  // being renamed, mailed on and opened by someone who never saw the screen.
  const text = looksLikeFormula(value) ? `'${value}` : value;
  return `"${text.replace(/"/g, '""')}"`;
}

/** A CSV row from cells that have not been quoted yet. */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map(csvCell).join(",");
}
