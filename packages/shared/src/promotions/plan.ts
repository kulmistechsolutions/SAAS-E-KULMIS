/**
 * Where each student goes when a class is promoted.
 *
 * "Auto (one grade up)" is the destination the promote screen offers for a
 * school-wide run, and for a class run where nobody picked a class by hand.
 * Nothing ever worked it out: the code asked for ONE destination class for
 * the whole run, found none, and skipped every child — then reported "No
 * eligible students to promote" over a table in which all 172 read Eligible.
 *
 * Both halves of that were wrong. The destination belongs to the student, not
 * to the run — Grade 7 goes to Grade 8 while Grade 3 goes to Grade 4 — and a
 * run that promotes nobody has to say which of the several possible reasons
 * it was, or the school is left staring at a screen that contradicts itself.
 *
 * Pure on purpose: it takes the class ladder and the students, and returns
 * the decision for each. That is what makes it testable without a browser.
 */

/** Why a student was left where they are. */
export type PromotionSkipReason =
  /** Failed an eligibility rule (fees, clearance, already promoted, inactive). */
  | "NOT_ELIGIBLE"
  /** Their class is not in this year's ladder, so there is no "next" to find. */
  | "CLASS_NOT_IN_LADDER"
  /** The chosen destination is the class they are already in. */
  | "ALREADY_THERE";

export type PromotionAction =
  | { studentId: string; action: "PROMOTE"; toClassName: string }
  | { studentId: string; action: "GRADUATE" }
  | { studentId: string; action: "SKIP"; reason: PromotionSkipReason };

export interface PromotionPlanStudent {
  id: string;
  className: string;
  /** The eligibility rules' verdict, decided before this. */
  eligible: boolean;
}

export interface PromotionPlan {
  actions: PromotionAction[];
  promoting: number;
  graduating: number;
  skipped: number;
  /** Skipped counts by reason — what an explanation is built from. */
  skippedBy: Record<PromotionSkipReason, number>;
}

/**
 * Decide, for each student, whether they move up, graduate, or stay.
 *
 * `toClassName` is the destination somebody chose by hand. Leave it out (the
 * "Auto" case) and each student is sent one step up their own ladder, which
 * is what the screen has always said it would do.
 *
 * A student sitting in the last class of the ladder graduates whether or not
 * a destination was chosen — finishing school is not a class you move to.
 */
export function planPromotions(input: {
  students: PromotionPlanStudent[];
  /** This year's classes, lowest first. */
  orderedClasses: string[];
  toClassName?: string | null;
}): PromotionPlan {
  const { students, orderedClasses } = input;
  const chosen = input.toClassName?.trim() || null;

  const actions: PromotionAction[] = [];
  const skippedBy: Record<PromotionSkipReason, number> = {
    NOT_ELIGIBLE: 0,
    CLASS_NOT_IN_LADDER: 0,
    ALREADY_THERE: 0,
  };
  const skip = (studentId: string, reason: PromotionSkipReason) => {
    skippedBy[reason] += 1;
    actions.push({ studentId, action: "SKIP", reason });
  };

  for (const student of students) {
    if (!student.eligible) {
      skip(student.id, "NOT_ELIGIBLE");
      continue;
    }

    const index = orderedClasses.indexOf(student.className);
    const isFinal = index !== -1 && index === orderedClasses.length - 1;
    if (isFinal) {
      actions.push({ studentId: student.id, action: "GRADUATE" });
      continue;
    }

    // A hand-picked destination wins; otherwise the next rung of their own
    // ladder. This is the line that was missing.
    const destination =
      chosen ?? (index === -1 ? null : (orderedClasses[index + 1] ?? null));

    if (!destination) {
      skip(student.id, "CLASS_NOT_IN_LADDER");
      continue;
    }
    if (destination === student.className) {
      skip(student.id, "ALREADY_THERE");
      continue;
    }
    actions.push({
      studentId: student.id,
      action: "PROMOTE",
      toClassName: destination,
    });
  }

  return {
    actions,
    promoting: actions.filter((a) => a.action === "PROMOTE").length,
    graduating: actions.filter((a) => a.action === "GRADUATE").length,
    skipped: actions.filter((a) => a.action === "SKIP").length,
    skippedBy,
  };
}

/**
 * Why nothing happened, in the words of the reason that actually applied.
 *
 * The old message said "No eligible students to promote" no matter what,
 * which was flatly untrue in the case that produced it most often — every
 * student eligible, and no next class to send them to.
 */
export function explainEmptyPromotion(plan: PromotionPlan): string {
  const { skippedBy, skipped } = plan;
  if (skipped === 0) return "There was nobody to promote.";

  const parts: string[] = [];
  if (skippedBy.CLASS_NOT_IN_LADDER > 0) {
    parts.push(
      `${skippedBy.CLASS_NOT_IN_LADDER} have no next class to move up to — add the next class for this academic year, or choose a destination class.`,
    );
  }
  if (skippedBy.ALREADY_THERE > 0) {
    parts.push(
      `${skippedBy.ALREADY_THERE} are already in the class you chose.`,
    );
  }
  if (skippedBy.NOT_ELIGIBLE > 0) {
    parts.push(
      `${skippedBy.NOT_ELIGIBLE} did not meet the eligibility rules.`,
    );
  }
  return `Nobody was promoted. ${parts.join(" ")}`;
}
