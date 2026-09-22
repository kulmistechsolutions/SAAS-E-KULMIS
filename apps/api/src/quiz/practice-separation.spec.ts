import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { onPaper } from "./quiz-version";

/**
 * A teacher's practice score must never appear anywhere a student's does.
 *
 * Not in results, reports, class averages, rankings, the parent portal, the
 * copilot. That guarantee is structural rather than a filter: practice runs
 * live in a table of their own, so the question is not "did every report
 * remember to leave them out" but "does anything other than the practice
 * code read that table at all". This walks the source and checks.
 */
const SRC = join(__dirname, "..");
const service = readFileSync(join(__dirname, "quiz.service.ts"), "utf8");
const controller = readFileSync(join(__dirname, "quiz.controller.ts"), "utf8");
const migration = readFileSync(
  join(
    __dirname,
    "..",
    "..",
    "prisma",
    "migrations",
    "20260923090000_quiz_practice_true_false",
    "migration.sql",
  ),
  "utf8",
);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") && !p.endsWith(".spec.ts")) out.push(p);
  }
  return out;
}

/** The body of one method of the quiz service. */
function method(name: string): string {
  const start = service.indexOf(`  async ${name}(`);
  if (start < 0) throw new Error(`no method ${name}`);
  const next = service.indexOf("\n  async ", start + 10);
  const priv = service.indexOf("\n  private ", start + 10);
  const ends = [next, priv].filter((i) => i > 0);
  return service.slice(start, ends.length ? Math.min(...ends) : undefined);
}

describe("nothing that reports on students can see a practice run", () => {
  it("is read and written only by the practice code", () => {
    const users = walk(SRC).filter((f) =>
      readFileSync(f, "utf8").includes("quizPracticeAttempt"),
    );
    expect(users.map((f) => f.replace(SRC, "").replace(/\\/g, "/"))).toEqual([
      "/quiz/quiz.service.ts",
    ]);
    // And within the service, only by submitPractice.
    const outside = service.replace(method("submitPractice"), "");
    expect(outside).not.toContain("quizPracticeAttempt");
  });

  it("never writes a quiz_attempt, a quiz_answer or a student's activity", () => {
    for (const name of ["practicePaper", "submitPractice"]) {
      const body = method(name);
      expect(body).not.toContain("tx.quizAttempt.");
      expect(body).not.toContain("tx.quizAnswer.");
      expect(body).not.toContain("recordActivity");
      // Nor the school's AI allowance, spent on a teacher checking a paper.
      expect(body).not.toContain("tryConsumeAiGrading");
      expect(body).not.toContain("gradeConcept");
    }
  });

  it("needs no student at all", () => {
    for (const name of ["practicePaper", "submitPractice"]) {
      const body = method(name);
      expect(body).not.toContain("tx.student.");
      expect(body).not.toContain("assertStudentEligible");
      // A draft is exactly when a teacher most needs to try it.
      expect(body).not.toContain('status: "PUBLISHED"');
      expect(body).not.toContain("assertQuizWindow");
    }
  });

  it("serves the teacher the same paper a student is served", () => {
    // One function for both, so what is tested is what is sat.
    expect(method("getByCode")).toContain("this.servePaper(quiz, questions)");
    expect(method("practicePaper")).toContain("this.servePaper(quiz, questions)");
  });

  it("grades by the same rules a student's answers are graded by", () => {
    expect(method("submitPractice")).toContain("this.gradeExact(q, answer)");
  });

  it("is isolated per school like every other tenant table", () => {
    expect(migration).toContain('"quiz_practice_attempts" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('"quiz_practice_attempts" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain(
      `USING ("schoolId" = current_setting('app.current_tenant', true))`,
    );
    expect(migration).toContain("TO app_user");
  });

  it("lets a teacher try only their own quiz", () => {
    for (const route of ['@Get(":id/practice")', '@Post(":id/practice")']) {
      const at = controller.indexOf(route);
      expect(at).toBeGreaterThan(0);
      const body = controller.slice(at, controller.indexOf("\n  }\n", at));
      expect(body).toContain("assertOwnsQuiz");
    }
  });
});

describe("an overridden mark is on the record", () => {
  it("is written to the audit log with the mark before and after", () => {
    const body = method("gradeAnswer");
    expect(body).toContain("this.audit.record(");
    expect(body).toContain('"QUIZ_MARK_OVERRIDDEN"');
    for (const field of ["marksBefore", "marksAfter", "studentAnswer", "reason", "scoreBefore", "scoreAfter"]) {
      expect(body).toContain(field);
    }
  });

  it("names who made the change", () => {
    expect(controller).toContain("username: me.username },");
  });

  it("is no longer limited to hand-marked questions", () => {
    // The whole point: "T" for TRUE, marked wrong by the system, accepted by
    // the teacher.
    expect(method("gradeAnswer")).not.toContain(
      "This answer does not require manual grading",
    );
  });

  it("keeps the grade in step with the new score", () => {
    expect(method("gradeAnswer")).toContain("grade: letterGrade(percentage)");
  });
});

describe("a student is graded on the paper they sat", () => {
  const t = (iso: string) => new Date(iso);
  const sat = { startedAt: t("2026-09-10T10:00:00Z"), quizVersion: "1.0" };

  it("includes a question that was there when they started", () => {
    expect(onPaper({ createdAt: t("2026-09-01T00:00:00Z"), retiredAt: null }, sat)).toBe(true);
  });

  it("includes one retired after they started", () => {
    // They answered it; it is still part of their paper.
    expect(
      onPaper(
        { createdAt: t("2026-09-01T00:00:00Z"), retiredAt: t("2026-09-11T00:00:00Z") },
        sat,
      ),
    ).toBe(true);
  });

  it("leaves out one retired before they started", () => {
    expect(
      onPaper(
        { createdAt: t("2026-09-01T00:00:00Z"), retiredAt: t("2026-09-05T00:00:00Z") },
        sat,
      ),
    ).toBe(false);
  });

  it("leaves out one added after they started", () => {
    // Counting it into their total would mark them down for a question they
    // were never shown.
    expect(onPaper({ createdAt: t("2026-09-12T00:00:00Z"), retiredAt: null }, sat)).toBe(false);
  });

  it("keeps the old behaviour for attempts from before versions existed", () => {
    // Their questions were recreated on every save and have no usable history.
    const legacy = { startedAt: t("2026-08-01T00:00:00Z"), quizVersion: null };
    expect(onPaper({ createdAt: t("2026-09-12T00:00:00Z"), retiredAt: null }, legacy)).toBe(true);
    expect(
      onPaper({ createdAt: t("2026-07-01T00:00:00Z"), retiredAt: t("2026-07-02T00:00:00Z") }, legacy),
    ).toBe(false);
  });

  it("is applied when submitting, reviewing and overriding", () => {
    for (const name of ["submitAttempt", "getAttemptReview", "gradeAnswer"]) {
      expect(method(name)).toContain("onPaper(q, ");
    }
  });
});
