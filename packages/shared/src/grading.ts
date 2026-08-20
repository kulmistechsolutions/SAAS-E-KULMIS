/**
 * Exam grading — the single source of truth shared by the API and the web
 * app, so a result card, a printed transcript, a portal page and an Excel
 * export can never disagree about what letter a score earns.
 *
 * A school configures its own ladder in Settings → Examinations → Grade
 * Configuration (persisted as School.gradeBands); these values are only the
 * fallback for a school that has not customised it.
 */

export interface GradeBand {
  min: number;
  max: number;
  grade: string;
}

/** Fallback ladder — mirrored by the settings seed the UI starts from. */
export const DEFAULT_GRADE_BANDS: GradeBand[] = [
  { min: 90, max: 100, grade: "A" },
  { min: 80, max: 89, grade: "B" },
  { min: 70, max: 79, grade: "C" },
  { min: 60, max: 69, grade: "D" },
  { min: 50, max: 59, grade: "E" },
  { min: 0, max: 49, grade: "F" },
];

/** Minimum overall percentage counted as a pass when a school hasn't set one. */
export const DEFAULT_PASSING_PERCENTAGE = 50;

/**
 * The grade a percentage earns under a school's own bands.
 *
 * Matching is on `min` alone — the highest band whose minimum the score
 * reaches — deliberately, NOT `min <= score <= max`. Schools write their
 * bands with whole-number maximums (…70-79, 80-89…), but a real average is
 * rarely whole: 79.8 sits in the gap between 79 and 80 and matched no band
 * at all, so it fell through to the lowest one and a passing student was
 * shown "F". Reading the bands as thresholds closes every such gap.
 */
export function gradeFromBands(
  score: number,
  bands: GradeBand[] = DEFAULT_GRADE_BANDS,
): string {
  const usable = bands.length > 0 ? bands : DEFAULT_GRADE_BANDS;
  // Highest minimum first, so the first band the score reaches wins.
  const sorted = [...usable].sort((a, b) => b.min - a.min);
  const band = sorted.find((b) => score >= b.min);
  // Below every band's minimum (a ladder that doesn't start at 0) — the
  // lowest band is still the right answer.
  return (band ?? sorted[sorted.length - 1]!).grade;
}

/**
 * An Excel `IF` chain equivalent to gradeFromBands, so a marks template's
 * live Grade column shows exactly what the system will compute.
 * `cell` is the address holding the average, e.g. "N5".
 */
export function gradeFormulaForExcel(
  cell: string,
  bands: GradeBand[] = DEFAULT_GRADE_BANDS,
): string {
  const usable = bands.length > 0 ? bands : DEFAULT_GRADE_BANDS;
  // Ascending, so folding left leaves the HIGHEST band as the outermost IF —
  // Excel evaluates outside-in, and a chain that tested the lowest minimum
  // first would hand every passing score the bottom grade.
  const sorted = [...usable].sort((a, b) => a.min - b.min);
  const lowest = sorted[0]!;
  // The lowest band becomes the final else rather than another IF layer.
  return sorted
    .slice(1)
    .reduce(
      (inner, b) => `IF(${cell}>=${b.min},"${b.grade}",${inner})`,
      `"${lowest.grade}"`,
    );
}
