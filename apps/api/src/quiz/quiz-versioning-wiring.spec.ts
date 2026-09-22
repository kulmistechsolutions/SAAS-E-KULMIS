import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Versioning is only worth anything if the rules reach the database.
 *
 * The arithmetic is tested on its own in quiz-version.spec.ts. This is the
 * other half: that a save actually consults it, that an attempt records the
 * paper it was sat on, and that a student halfway through keeps theirs.
 */
const HERE = __dirname;
const service = readFileSync(join(HERE, "quiz.service.ts"), "utf8");
const controller = readFileSync(join(HERE, "quiz.controller.ts"), "utf8");
const schema = readFileSync(
  join(HERE, "..", "..", "prisma", "schema.prisma"),
  "utf8",
);
const shared = readFileSync(
  join(HERE, "..", "..", "..", "..", "packages", "shared", "src", "schemas", "quiz.ts"),
  "utf8",
);

describe("the edit says which kind of change it is", () => {
  it("is asked for, and defaults to a correction", () => {
    expect(shared).toContain('editMode: z.enum(["CORRECTION", "NEW_VERSION"]).optional()');
    expect(service).toContain('const mode: QuizEditMode = dto.editMode ?? "CORRECTION";');
  });

  it("takes a reason in the teacher's own words", () => {
    expect(shared).toContain("editReason: z.string().max(300).optional()");
    expect(service).toContain("reason: dto.editReason ?? null");
  });
});

describe("a new version replaces rather than edits", () => {
  it("only where the substance moved", () => {
    expect(service).toContain(
      'diffs.filter((d) => mode === "NEW_VERSION" && needsReplacement(d))',
    );
  });

  it("retires the old question and creates its successor", () => {
    expect(service).toMatch(
      /if \(id && known\.has\(id\) && replace\.has\(id\)\) \{[\s\S]{0,400}retiredAt: new Date\(\)[\s\S]{0,300}quizQuestion\.create\(/,
    );
  });
});

describe("the version only moves once somebody has sat it", () => {
  it("leaves a draft where it is", () => {
    expect(service).toContain('const published = quiz.status !== "DRAFT";');
    expect(service).toContain("if (published && changed) {");
  });

  it("does not move it when nothing actually changed", () => {
    // Opening the editor and pressing Save should not invent a version.
    expect(service).toContain('const changed = diffs.some((d) => d.kind !== "UNCHANGED");');
  });
});

describe("the change is written down", () => {
  it("with the version it produced, what changed and who did it", () => {
    expect(service).toContain("tx.quizVersionChange.create({");
    expect(service).toContain("summary: summarise(diffs)");
    expect(service).toContain("changedByName: opts?.username ?? null");
    expect(controller).toContain("username: me.username,");
  });

  it("keeps the before and after, not just a count", () => {
    expect(service).toContain("details: diffs.filter(");
  });

  it("is readable, and says who sat which version", () => {
    expect(service).toContain("async versionHistory(");
    expect(service).toContain('by: ["quizVersion"]');
    expect(controller).toContain('@Get(":id/history")');
  });

  it("declares the history route before the id route", () => {
    // Nest matches in order; ":id" would otherwise swallow "history".
    // Matched as a decorator on its own line, so the comment that explains
    // this above the route is not mistaken for the route itself.
    const line = (route: string) =>
      controller.split("\n").findIndex((l) => l.trim() === `@Get("${route}")`);
    expect(line(":id/history")).toBeGreaterThan(-1);
    expect(line(":id")).toBeGreaterThan(-1);
    expect(line(":id/history")).toBeLessThan(line(":id"));
  });
});

describe("a student keeps the paper they started", () => {
  it("records the version on the attempt", () => {
    expect(schema).toContain("quizVersion    String?");
    expect(service).toContain("quizVersion: quiz.version,");
  });

  it("serves a mid-attempt student the paper as it stood then", () => {
    expect(service).toContain("status: \"IN_PROGRESS\", quiz: { code } }");
    expect(service).toContain("createdAt: { lte: asOf }");
    expect(service).toContain("OR: [{ retiredAt: null }, { retiredAt: { gt: asOf } }]");
  });

  it("gives everyone else the current one", () => {
    expect(service).toContain(": { retiredAt: null };");
  });
});

describe("the change log is the school's own", () => {
  it("is row-level isolated like every other tenant table", () => {
    const migration = readFileSync(
      join(
        HERE, "..", "..", "prisma", "migrations",
        "20260922140000_quiz_versioning", "migration.sql",
      ),
      "utf8",
    );
    expect(migration).toContain('ALTER TABLE "quiz_version_changes" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('FORCE ROW LEVEL SECURITY');
    expect(migration).toContain("current_setting('app.current_tenant', true)");
  });
});
