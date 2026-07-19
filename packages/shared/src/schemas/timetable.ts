import { z } from "zod";

/**
 * Timetable (Module 12).
 *
 * Times are minutes from midnight (07:50 = 470). A lesson slot is a wall-clock
 * position in a weekday rather than an instant, so minutes keep the maths exact
 * and — crucially — directly comparable between a morning and an afternoon
 * shift.
 *
 * Weekdays use the JavaScript getDay() convention: 0 = Sunday … 6 = Saturday.
 */

const minuteOfDay = z.number().int().min(0).max(1440);
const weekday = z.number().int().min(0).max(6);

/** "07:50" → 470. Returns null when the text is not a valid time. */
export function parseTimeToMinutes(value: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return null;
  return h * 60 + min;
}

/** 470 → "07:50". */
export function formatMinutes(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

// ── Shift + period grid ────────────────────────────────────────────────────

export const shiftPeriodInputSchema = z
  .object({
    name: z.string().min(1).max(30),
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
    isBreak: z.boolean().default(false),
  })
  .refine((p) => p.endMinute > p.startMinute, {
    message: "A period must end after it starts",
    path: ["endMinute"],
  });
export type ShiftPeriodInput = z.infer<typeof shiftPeriodInputSchema>;

export const saveShiftSchema = z
  .object({
    academicYearId: z.string().min(1),
    name: z.string().min(1).max(60),
    /** Working days, e.g. [6,0,1,2,3] = Saturday–Wednesday. */
    days: z.array(weekday).min(1, "Pick at least one working day"),
    /** The whole daily grid, in order. Breaks included. */
    periods: z.array(shiftPeriodInputSchema).min(1, "Add at least one period"),
  })
  .superRefine((dto, ctx) => {
    if (new Set(dto.days).size !== dto.days.length) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "The same weekday is listed twice",
        path: ["days"],
      });
    }
    // Overlapping periods would make the whole timetable unsolvable in ways
    // that are hard to explain later, so reject them at the source. The
    // database enforces this too; catching it here gives a better message.
    const sorted = [...dto.periods].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i]!.startMinute < sorted[i - 1]!.endMinute) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `"${sorted[i - 1]!.name}" and "${sorted[i]!.name}" overlap`,
          path: ["periods"],
        });
        break;
      }
    }
    if (dto.periods.every((p) => p.isBreak)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "A shift needs at least one teaching period",
        path: ["periods"],
      });
    }
  });
export type SaveShiftInput = z.infer<typeof saveShiftSchema>;

/** Put a classroom into a shift. Section wins over class when both are set. */
export const assignShiftSchema = z.object({
  shiftId: z.string().min(1).nullable(),
  classId: z.string().min(1).optional(),
  sectionId: z.string().min(1).optional(),
});
export type AssignShiftInput = z.infer<typeof assignShiftSchema>;

// ── Lesson allocation ──────────────────────────────────────────────────────

export const subjectLoadRowSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  subjectId: z.string().min(1),
  /** 0 removes the row — the subject simply isn't timetabled. */
  periodsPerWeek: z.number().int().min(0).max(60),
});
export type SubjectLoadRow = z.infer<typeof subjectLoadRowSchema>;

/** The whole allocation grid is saved in one go, so a half-saved grid can't
 *  leave a class silently short of periods. */
export const saveSubjectLoadsSchema = z.object({
  academicYearId: z.string().min(1),
  rows: z.array(subjectLoadRowSchema),
});
export type SaveSubjectLoadsInput = z.infer<typeof saveSubjectLoadsSchema>;

// ── Teacher unavailability ─────────────────────────────────────────────────

export const teacherUnavailabilitySchema = z
  .object({
    teacherId: z.string().min(1),
    dayOfWeek: weekday,
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
    reason: z.string().max(200).optional(),
  })
  .refine((r) => r.endMinute > r.startMinute, {
    message: "The window must end after it starts",
    path: ["endMinute"],
  });
export type TeacherUnavailabilityInput = z.infer<
  typeof teacherUnavailabilitySchema
>;

/** Replaces every window for one teacher, so the grid UI can just send its
 *  current state instead of diffing. */
export const saveTeacherUnavailabilitySchema = z.object({
  teacherId: z.string().min(1),
  windows: z.array(
    z
      .object({
        dayOfWeek: weekday,
        startMinute: minuteOfDay,
        endMinute: minuteOfDay,
        reason: z.string().max(200).optional(),
      })
      .refine((r) => r.endMinute > r.startMinute, {
        message: "The window must end after it starts",
        path: ["endMinute"],
      }),
  ),
});
export type SaveTeacherUnavailabilityInput = z.infer<
  typeof saveTeacherUnavailabilitySchema
>;

// ── Feasibility report ─────────────────────────────────────────────────────

/**
 * Severity of a pre-generation finding.
 * BLOCKER — generation cannot succeed; fix it first.
 * WARNING — generation will succeed but the result will bend a soft rule.
 */
export type FeasibilityLevel = "BLOCKER" | "WARNING";

export interface FeasibilityIssue {
  level: FeasibilityLevel;
  /** Machine-readable so the UI can link to the right wizard step. */
  code:
    | "NO_SHIFT"
    | "NO_PERIODS"
    | "CLASS_UNDER_ALLOCATED"
    | "CLASS_OVER_ALLOCATED"
    | "SUBJECT_WITHOUT_TEACHER"
    | "TEACHER_OVERLOADED"
    | "TEACHER_TIGHT"
    | "SUBJECT_EXCEEDS_DAYS";
  message: string;
  classId?: string;
  sectionId?: string | null;
  subjectId?: string;
  teacherId?: string;
}

export interface ClassFeasibility {
  classId: string;
  sectionId: string | null;
  label: string;
  /** Slots available per week = teaching periods × working days. */
  capacity: number;
  allocated: number;
}

export interface TeacherFeasibility {
  teacherId: string;
  name: string;
  /** Total lessons this teacher must deliver across every class and shift. */
  load: number;
  /** Slots left once unavailability windows are removed. */
  available: number;
}

export interface FeasibilityReport {
  ok: boolean;
  issues: FeasibilityIssue[];
  classes: ClassFeasibility[];
  teachers: TeacherFeasibility[];
}

// ── Generation ─────────────────────────────────────────────────────────────

export const generateTimetableSchema = z.object({
  academicYearId: z.string().min(1),
  shiftId: z.string().min(1),
});
export type GenerateTimetableInput = z.infer<typeof generateTimetableSchema>;

// ── Natural-language constraints ───────────────────────────────────────────

/**
 * The AI layer translates a sentence into one of these, and nothing else. It
 * never produces a timetable: scheduling stays with the solver, which can prove
 * its answer, while the model only does the part it is actually good at —
 * understanding what a person meant.
 */
export const aiProposalSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("TEACHER_UNAVAILABLE"),
    teacherId: z.string().min(1),
    teacherName: z.string(),
    windows: z
      .array(
        z.object({
          dayOfWeek: z.number().int().min(0).max(6),
          startMinute: minuteOfDay,
          endMinute: minuteOfDay,
        }),
      )
      .min(1),
  }),
  z.object({
    kind: z.literal("SUBJECT_TIME"),
    subjectId: z.string().min(1),
    subjectName: z.string(),
    /** Null means every class taking the subject. */
    classId: z.string().min(1).nullable(),
    className: z.string().nullable(),
    startMinute: minuteOfDay,
    endMinute: minuteOfDay,
  }),
]);
export type AiProposal = z.infer<typeof aiProposalSchema>;

export const interpretConstraintSchema = z.object({
  academicYearId: z.string().min(1),
  shiftId: z.string().min(1),
  text: z.string().min(3).max(500),
});
export type InterpretConstraintInput = z.infer<typeof interpretConstraintSchema>;

/** Applying takes STRUCTURED proposals the admin has already seen — never the
 *  raw sentence. Whatever a model was talked into saying, nothing reaches the
 *  database that was not shown and confirmed first. */
export const applyConstraintsSchema = z.object({
  academicYearId: z.string().min(1),
  proposals: z.array(aiProposalSchema).min(1),
});
export type ApplyConstraintsInput = z.infer<typeof applyConstraintsSchema>;

export interface InterpretResult {
  proposals: AiProposal[];
  /** Plain-language restatement, so the admin confirms meaning, not JSON. */
  summaries: string[];
  /** Names the model used that no record matched — reported, never guessed. */
  unresolved: string[];
}
