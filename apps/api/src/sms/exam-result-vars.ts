/**
 * Turning one student's exam result into the values an SMS template asks for.
 *
 * A school writes the message once — "Ardayga: {student_name} … SO: {SO} …
 * Celcelis: {average}% … Darajo: {position}" — and every parent gets their own
 * child's numbers in it. Everything here is a pure function of marks that have
 * already been computed elsewhere, so what a parent is told and what the result
 * sheet says cannot drift apart: the same totals, the same grade ladder, the
 * same pass mark.
 *
 * Positions are computed here rather than read from anywhere, because nothing
 * else in the system has ever needed them. They are competition-ranked —
 * 1, 2, 2, 4 — which is what a school means by "joint second".
 */

export interface SubjectScore {
  /** The subject's own code where it has one ("SO", "MA"), else its name. */
  code: string;
  name: string;
  mark: number | null;
  grade?: string;
}

export interface StudentResult {
  studentId: string;
  studentName: string;
  studentCode: string;
  className: string;
  sectionName: string | null;
  subjects: SubjectScore[];
  totalObtained: number;
  totalMax: number;
  average: number;
  grade: string;
  passed: boolean;
}

export interface ResultContext {
  examName: string;
  term: string;
  academicYear: string;
  schoolName: string;
  schoolPhone: string;
  schoolAddress: string;
  parentName: string;
  parentPhone: string;
  /** 1-based, competition-ranked within the class. */
  position: number;
  /** How many students the position is out of. */
  positionOf: number;
  /** The same, within the student's own section, where there is one. */
  sectionPosition: number | null;
  sectionPositionOf: number | null;
  passLabel: string;
  failLabel: string;
}

/**
 * Rank students by total marks, highest first, ties sharing a place.
 *
 * Competition ranking (1, 2, 2, 4) rather than dense (1, 2, 2, 3): a school
 * telling two parents their child came second means the next child came
 * fourth, and saying "third" to that parent would be wrong in the only way
 * that matters to them.
 *
 * A student with nothing marked is not ranked at all — they did not place
 * last, they have no result yet, and a parent told "Position: 32" about an
 * exam their child has not been marked for is being told something false.
 */
export function positions(
  rows: { studentId: string; totalObtained: number; marked: boolean }[],
): Map<string, { position: number; outOf: number }> {
  const ranked = rows.filter((r) => r.marked);
  const sorted = [...ranked].sort((a, b) => b.totalObtained - a.totalObtained);
  const out = new Map<string, { position: number; outOf: number }>();

  let place = 0;
  let seen = 0;
  let previous: number | null = null;
  for (const row of sorted) {
    seen += 1;
    if (previous === null || row.totalObtained !== previous) {
      place = seen;
      previous = row.totalObtained;
    }
    out.set(row.studentId, { position: place, outOf: ranked.length });
  }
  return out;
}

/** "1st", "2nd", "3rd", "11th"… for schools writing in English. */
export function ordinal(n: number): string {
  const tens = n % 100;
  if (tens >= 11 && tens <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "1aad", "2aad", "3aad"… — how a Somali school writes a place. */
export function ordinalSo(n: number): string {
  return n === 1 ? "1aad" : `${n}aad`;
}

export interface SubjectLineOptions {
  /**
   * Only these subject ids, in this order. Empty or absent means every subject
   * in the exam — the school picks which behaviour it wants in settings, and
   * an exam with fourteen subjects is why the choice exists.
   */
  only?: string[];
  /** "SO: 90" against "SO 90". */
  separator?: string;
  /** What joins the lines. A newline costs nothing extra in GSM-7. */
  joiner?: string;
  /** What to print where a subject was never marked. */
  missing?: string;
}

/**
 * The per-subject block, as one string.
 *
 * Built here rather than in the template so a school cannot end up writing
 * fourteen lines by hand and getting them out of step with the exam. The
 * subject's code is preferred over its name because an SMS is charged by the
 * character: "SO: 90" against "Somali: 90" is four characters a subject, and
 * six subjects of that is a second segment for every parent.
 */
export function subjectLines(
  subjects: SubjectScore[],
  opts: SubjectLineOptions = {},
): string {
  const sep = opts.separator ?? ": ";
  const joiner = opts.joiner ?? "\n";
  const missing = opts.missing ?? "-";

  const chosen =
    opts.only && opts.only.length > 0
      ? opts.only
          .map((id) => subjects.find((s) => s.code === id || s.name === id))
          .filter((s): s is SubjectScore => Boolean(s))
      : subjects;

  return chosen
    .map((s) => `${s.code}${sep}${s.mark === null ? missing : s.mark}`)
    .join(joiner);
}

/**
 * Every value a template may name, for one student.
 *
 * Both spellings of each: the PRD's `{student_name}` and the Somali templates
 * the system already ships with. Each subject is also addressable by its own
 * code, so "SO: {SO}" works and a school can lay its subjects out however it
 * likes rather than taking the block whole.
 */
export function buildResultVars(
  result: StudentResult,
  ctx: ResultContext,
  lineOpts?: SubjectLineOptions,
): Record<string, string> {
  const percentage = `${result.average}`;
  const vars: Record<string, string> = {
    // Student
    student_name: result.studentName,
    student_id: result.studentCode,
    class_name: result.className,
    section_name: result.sectionName ?? "",

    // Parent
    parent_name: ctx.parentName,
    guardian_name: ctx.parentName,
    parent_phone: ctx.parentPhone,

    // Exam
    exam_name: ctx.examName,
    term_name: ctx.term,
    term: ctx.term,
    academic_year: ctx.academicYear,

    // Results
    total_marks: `${result.totalObtained}`,
    total: `${result.totalObtained}`,
    total_max: `${result.totalMax}`,
    total_out_of: `${result.totalObtained}/${result.totalMax}`,
    average: percentage,
    percentage: `${percentage}%`,
    grade: result.grade,
    result_status: result.passed ? ctx.passLabel : ctx.failLabel,

    // Where they placed. Blank rather than "0" when there is nothing to
    // place — a parent told their child came 0th has been told nonsense.
    position: ctx.position > 0 ? `${ctx.position}` : "",
    position_ordinal: ctx.position > 0 ? ordinal(ctx.position) : "",
    position_so: ctx.position > 0 ? ordinalSo(ctx.position) : "",
    position_of: ctx.position > 0 ? `${ctx.position}/${ctx.positionOf}` : "",
    class_position: ctx.position > 0 ? `${ctx.position}` : "",
    section_position:
      ctx.sectionPosition && ctx.sectionPosition > 0
        ? `${ctx.sectionPosition}`
        : "",

    // Subjects, as a block
    subjects: subjectLines(result.subjects, lineOpts),
    subject_lines: subjectLines(result.subjects, lineOpts),

    // School
    school_name: ctx.schoolName,
    school_phone: ctx.schoolPhone,
    school_address: ctx.schoolAddress,
  };

  // The same values under the names the renderer's own alias table knows, so
  // that a school's existing exam-result template keeps working. Every school
  // ships with one written in Somali double braces — "Salaan {{Magaca
  // Waalidka}}, {{Magaca Ardayga}} wuxuu ku dhacay {{Dhibcaha}}…" — and those
  // tokens resolve through camelCase keys, not the handbook's snake_case. With
  // only one spelling present the built-in template rendered as "Salaan ,
  // wuxuu ku dhacay  imtixaanka ." — a blank message to every parent, sent
  // without anything having failed.
  vars.studentName = result.studentName;
  vars.studentCode = result.studentCode;
  vars.className = result.className;
  vars.section = result.sectionName ?? "";
  vars.parentName = ctx.parentName;
  vars.schoolName = ctx.schoolName;
  vars.examName = ctx.examName;
  vars.academicYear = ctx.academicYear;
  // "Dhibcaha" is what the child scored. The percentage reads as a result to a
  // parent; a raw total means nothing without the maximum beside it.
  vars.marks = `${percentage}%`;

  // Each subject by its own code and by its name, so a template can place
  // them itself: "SO: {SO}  MA: {MA}".
  for (const s of result.subjects) {
    const value = s.mark === null ? "" : `${s.mark}`;
    vars[s.code] = value;
    vars[s.name] = value;
    vars[`${s.code}_grade`] = s.grade ?? "";
  }

  return vars;
}
