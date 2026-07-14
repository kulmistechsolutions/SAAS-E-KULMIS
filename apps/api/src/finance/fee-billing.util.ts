/** Academic-year month sequence and calendar helpers for dual fee billing. */

export type MonthSlot = { year: number; month: number; sequenceIndex: number };

/** Build N consecutive months starting at `startMonth` (1–12). */
export function academicMonthSequence(
  startMonth: number,
  count: number,
): number[] {
  const months: number[] = [];
  let m = startMonth;
  for (let i = 0; i < count; i++) {
    months.push(m);
    m += 1;
    if (m > 12) m = 1;
  }
  return months;
}

/** Calendar year for a billing month within an academic year that starts in `startMonth`. */
export function calendarYearForMonth(
  startMonth: number,
  month: number,
  academicStartYear: number,
): number {
  return month >= startMonth ? academicStartYear : academicStartYear + 1;
}

export function parseAcademicStartYear(
  academicYearName: string,
  fallback = new Date().getFullYear(),
): number {
  const m = academicYearName.match(/(\d{4})/);
  return m ? Number(m[1]) : fallback;
}

export function buildMonthSlots(
  startMonth: number,
  count: number,
  academicStartYear: number,
): MonthSlot[] {
  const months = academicMonthSequence(startMonth, count);
  return months.map((month, sequenceIndex) => ({
    year: calendarYearForMonth(startMonth, month, academicStartYear),
    month,
    sequenceIndex,
  }));
}

export function monthIndexInSequence(
  slots: MonthSlot[],
  year: number,
  month: number,
): number {
  return slots.findIndex((s) => s.year === year && s.month === month);
}

export function currentCalendarMonth(): { year: number; month: number } {
  const now = new Date();
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1 };
}

export function nextCalendarMonth(year: number, month: number): {
  year: number;
  month: number;
} {
  let m = month + 1;
  let y = year;
  if (m > 12) {
    m = 1;
    y += 1;
  }
  return { year: y, month: m };
}
