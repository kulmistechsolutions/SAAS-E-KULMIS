/**
 * What a change to a published quiz means, and what it costs.
 *
 * A teacher who fixes a spelling mistake and a teacher who rewrites question 5
 * are doing two different things, and the difference decides what a student
 * who already sat the paper is shown. Correcting the spelling in place is
 * right: they sat that question, only misspelt. Changing what it asks is not —
 * their answer was to the old question, and showing them the new one beside
 * their old answer makes them look wrong when they were not.
 *
 * So the edit says which it is, and the two behave differently:
 *
 *   CORRECTION   the question is updated in place, minor version up (1.0 → 1.1)
 *   NEW_VERSION  the old question is retired and a new one takes its place,
 *                major version up (1.0 → 2.0)
 *
 * Everything here is a pure function of its inputs, so the rules can be read
 * as rules rather than inferred from what the database did afterwards.
 */

export type QuizEditMode = "CORRECTION" | "NEW_VERSION";

export type ChangeAction =
  | "CORRECTION"
  | "NEW_VERSION"
  | "PUBLISH"
  | "CLOSE"
  | "ARCHIVE"
  | "REOPEN";

/** "1.4" → { major: 1, minor: 4 }. Anything unreadable starts again at 1.0. */
export function parseVersion(v: string | null | undefined): {
  major: number;
  minor: number;
} {
  const m = /^(\d+)\.(\d+)$/.exec((v ?? "").trim());
  if (!m) return { major: 1, minor: 0 };
  return { major: Number(m[1]), minor: Number(m[2]) };
}

export function formatVersion(major: number, minor: number): string {
  return `${major}.${minor}`;
}

/**
 * The version an edit produces.
 *
 * A correction moves the minor number; a new version moves the major and
 * resets the minor, because 2.0 is a different paper rather than 1.7 with one
 * more fix on it.
 *
 * A draft never moves: nobody has sat it, so there is nothing to distinguish
 * this edit from writing the quiz in the first place, and a draft that reached
 * 1.9 before publication tells the school nothing.
 */
export function nextVersion(
  current: string | null | undefined,
  mode: QuizEditMode,
  opts: { published: boolean },
): string {
  const { major, minor } = parseVersion(current);
  if (!opts.published) return formatVersion(major, minor);
  return mode === "NEW_VERSION"
    ? formatVersion(major + 1, 0)
    : formatVersion(major, minor + 1);
}

export interface QuestionLike {
  id?: string;
  question: string;
  questionType: string;
  options: string[];
  correctAnswer?: string;
  marks: number;
  pairs?: { left: string; right: string }[];
  blanks?: string[];
}

export interface QuestionDiff {
  id: string | null;
  kind: "ADDED" | "REMOVED" | "EDITED" | "UNCHANGED";
  before?: { question: string; correctAnswer: string; marks: number };
  after?: { question: string; correctAnswer: string; marks: number };
  /** Which fields moved — what a school actually wants to read. */
  fields: string[];
}

function shape(q: QuestionLike) {
  return {
    question: q.question,
    correctAnswer: q.correctAnswer ?? "",
    marks: q.marks,
    questionType: q.questionType,
    options: [...(q.options ?? [])],
    pairs: q.pairs ?? [],
    blanks: q.blanks ?? [],
  };
}

/**
 * What changed between the paper as it stands and the paper being saved.
 *
 * Written for a person to read, not a machine to diff: a school looking at
 * this wants "question 5: the correct answer changed", not two JSON blobs.
 */
export function diffQuestions(
  before: (QuestionLike & { id: string })[],
  after: QuestionLike[],
): QuestionDiff[] {
  const byId = new Map(before.map((q) => [q.id, q]));
  const seen = new Set<string>();
  const out: QuestionDiff[] = [];

  for (const q of after) {
    const old = q.id ? byId.get(q.id) : undefined;
    if (!old) {
      out.push({
        id: q.id ?? null,
        kind: "ADDED",
        after: {
          question: q.question,
          correctAnswer: q.correctAnswer ?? "",
          marks: q.marks,
        },
        fields: [],
      });
      continue;
    }
    seen.add(old.id);

    const a = shape(old);
    const b = shape(q);
    const fields: string[] = [];
    if (a.question !== b.question) fields.push("question");
    if (a.correctAnswer !== b.correctAnswer) fields.push("correctAnswer");
    if (a.marks !== b.marks) fields.push("marks");
    if (a.questionType !== b.questionType) fields.push("questionType");
    if (JSON.stringify(a.options) !== JSON.stringify(b.options)) {
      fields.push("options");
    }
    if (JSON.stringify(a.pairs) !== JSON.stringify(b.pairs)) fields.push("pairs");
    if (JSON.stringify(a.blanks) !== JSON.stringify(b.blanks)) {
      fields.push("blanks");
    }

    out.push({
      id: old.id,
      kind: fields.length === 0 ? "UNCHANGED" : "EDITED",
      before: {
        question: a.question,
        correctAnswer: a.correctAnswer,
        marks: a.marks,
      },
      after: {
        question: b.question,
        correctAnswer: b.correctAnswer,
        marks: b.marks,
      },
      fields,
    });
  }

  for (const old of before) {
    if (seen.has(old.id)) continue;
    const a = shape(old);
    out.push({
      id: old.id,
      kind: "REMOVED",
      before: {
        question: a.question,
        correctAnswer: a.correctAnswer,
        marks: a.marks,
      },
      fields: [],
    });
  }

  return out;
}

/**
 * Which questions a NEW_VERSION has to replace rather than edit.
 *
 * Only the ones whose substance moved. Re-creating a question whose marks went
 * from 2 to 3 would strand every answer to it for no reason: the question is
 * the same question, worth more. What makes it a different question is what it
 * asks, what counts as right, or what it offers to choose from.
 */
const SUBSTANTIVE = new Set([
  "question",
  "correctAnswer",
  "options",
  "questionType",
  "pairs",
  "blanks",
]);

export function needsReplacement(diff: QuestionDiff): boolean {
  return (
    diff.kind === "EDITED" && diff.fields.some((f) => SUBSTANTIVE.has(f))
  );
}

/** One line a school can read, from a diff nobody wants to read raw. */
export function summarise(diffs: QuestionDiff[]): string {
  const added = diffs.filter((d) => d.kind === "ADDED").length;
  const removed = diffs.filter((d) => d.kind === "REMOVED").length;
  const edited = diffs.filter((d) => d.kind === "EDITED").length;

  const parts: string[] = [];
  if (edited) parts.push(`${edited} question${edited > 1 ? "s" : ""} edited`);
  if (added) parts.push(`${added} added`);
  if (removed) parts.push(`${removed} removed`);
  return parts.length > 0 ? parts.join(", ") : "No question changes";
}

/**
 * Whether a question was on the paper a given attempt was sat on.
 *
 * A NEW_VERSION edit retires a question and adds its replacement; a CORRECTION
 * may add a question. A student who started before either sat the paper as it
 * stood then, and is graded and shown that paper — not the one the teacher
 * has since made. Attempts from before versions existed carry no version and
 * keep the old behaviour, the current paper, because their questions were
 * recreated wholesale on every save and have no usable history.
 */
export function onPaper(
  q: { createdAt: Date; retiredAt: Date | null },
  attempt: { startedAt: Date; quizVersion: string | null },
): boolean {
  if (!attempt.quizVersion) return !q.retiredAt;
  const asOf = attempt.startedAt.getTime();
  if (q.createdAt.getTime() > asOf) return false;
  return !q.retiredAt || q.retiredAt.getTime() > asOf;
}
