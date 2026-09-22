import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { QuestionBankService } from "./question-bank.service";

/**
 * The question bank: whose questions a person sees, whose they may change,
 * and that a question goes into a quiz as a copy.
 *
 * The first two are behaviour, tested against the real service with the
 * database stood in for; the rest is wiring, checked in the source.
 */

type Row = Record<string, unknown> & { id: string; teacherId: string | null };

/** A service whose database records what it was asked. */
function harness(opts: { teacherId?: string | null; rows?: Row[] } = {}) {
  const calls: { op: string; args: unknown }[] = [];
  const rows = opts.rows ?? [];
  const tx = {
    questionBankItem: {
      count: async (args: unknown) => (calls.push({ op: "count", args }), rows.length),
      findMany: async (args: unknown) => (calls.push({ op: "findMany", args }), rows),
      findFirst: async (args: { where: { id?: string } }) => (
        calls.push({ op: "findFirst", args }),
        rows.find((r) => r.id === args.where.id) ?? null
      ),
      create: async (args: unknown) => (calls.push({ op: "create", args }), { id: "new" }),
      update: async (args: unknown) => (calls.push({ op: "update", args }), { id: "x" }),
      updateMany: async (args: unknown) => (calls.push({ op: "updateMany", args }), { count: 1 }),
      delete: async () => {
        throw new Error("the bank never deletes");
      },
    },
    subject: { findMany: async () => [] },
    class: { findMany: async () => [] },
    academicYear: { findMany: async () => [] },
    teacher: { findMany: async () => [] },
  };
  const tenants: string[] = [];
  const prisma = {
    forTenant: async (schoolId: string, fn: (t: typeof tx) => unknown) => {
      tenants.push(schoolId);
      return fn(tx);
    },
  };
  const teachers = {
    findByUserId: async () => ({ id: opts.teacherId ?? "t-me" }),
  };
  const owned: string[] = [];
  const quiz = {
    assertOwnsQuiz: async (_s: string, _u: string, quizId: string) => {
      owned.push(quizId);
      return "t-me";
    },
  };
  const svc = new QuestionBankService(
    prisma as never,
    teachers as never,
    quiz as never,
  );
  return { svc, calls, tenants, owned };
}

const teacher = { userId: "u1", role: "TEACHER", username: "cali" };
const admin = { userId: "u9", role: "ADMINISTRATOR", username: "admin" };
const base = { skip: 0, take: 25 };

describe("whose questions a person sees", () => {
  it("shows a teacher their own and the shared ones, never archived", async () => {
    const h = harness({ teacherId: "t-me" });
    await h.svc.list("school-a", teacher, base);
    const where = (h.calls.find((c) => c.op === "findMany")!.args as { where: { AND: unknown[] } }).where;
    expect(where.AND[0]).toEqual({
      archivedAt: null,
      OR: [{ teacherId: "t-me" }, { shared: true }],
    });
  });

  it("shows an administrator everything in their school that is not archived", async () => {
    const h = harness();
    await h.svc.list("school-a", admin, base);
    const where = (h.calls.find((c) => c.op === "findMany")!.args as { where: { AND: unknown[] } }).where;
    expect(where.AND[0]).toEqual({ archivedAt: null });
  });

  it("runs inside the school's own tenant, every time", async () => {
    const h = harness();
    await h.svc.list("school-a", admin, base);
    await h.svc.options("school-a", admin);
    await h.svc.use("school-a", admin, { ids: ["x"] });
    expect(new Set(h.tenants)).toEqual(new Set(["school-a"]));
  });

  it("applies every filter the PRD names", async () => {
    const h = harness();
    await h.svc.list("s", admin, {
      ...base,
      questionType: "TRUE_FALSE_WRITTEN",
      language: "ar",
      subjectId: "sub",
      classId: "cls",
      topic: "Tajwiid",
      difficulty: "HARD",
      teacherId: "t2",
      academicYearId: "y",
    });
    const and = JSON.stringify(
      (h.calls.find((c) => c.op === "findMany")!.args as { where: unknown }).where,
    );
    for (const bit of [
      '"questionType":"TRUE_FALSE_WRITTEN"',
      '"language":"ar"',
      '"subjectId":"sub"',
      '"classId":"cls"',
      '"difficulty":"HARD"',
      '"teacherId":"t2"',
      '"academicYearId":"y"',
      '"equals":"Tajwiid"',
    ]) {
      expect(and).toContain(bit);
    }
  });
});

describe("whose questions a person may change", () => {
  const rows: Row[] = [
    { id: "mine", teacherId: "t-me" },
    { id: "theirs", teacherId: "t-other" },
  ];

  it("lets a teacher change their own", async () => {
    const h = harness({ teacherId: "t-me", rows });
    await expect(h.svc.update("s", teacher, "mine", { meta: { topic: "x" } })).resolves.toBeTruthy();
  });

  it("refuses a teacher a colleague's shared question", async () => {
    const h = harness({ teacherId: "t-me", rows });
    await expect(h.svc.update("s", teacher, "theirs", { meta: { topic: "x" } })).rejects.toThrow(
      "You can only change questions you wrote",
    );
    await expect(h.svc.archive("s", teacher, "theirs")).rejects.toThrow(
      "You can only remove questions you wrote",
    );
  });

  it("lets an administrator change any", async () => {
    const h = harness({ rows });
    await expect(h.svc.update("s", admin, "theirs", { meta: { topic: "x" } })).resolves.toBeTruthy();
  });

  it("marks each row with whether the person may change it", async () => {
    const h = harness({ teacherId: "t-me", rows });
    const r = await h.svc.list("s", teacher, base);
    expect(r.items.map((i) => [i.id, i.canEdit])).toEqual([
      ["mine", true],
      ["theirs", false],
    ]);
  });

  it("archives rather than deletes", async () => {
    const h = harness({ teacherId: "t-me", rows });
    await h.svc.archive("s", teacher, "mine");
    const upd = h.calls.find((c) => c.op === "update")!.args as { data: { archivedAt: Date } };
    expect(upd.data.archivedAt).toBeInstanceOf(Date);
  });

  it("checks a teacher owns the quiz before saving its questions", async () => {
    const h = harness({ teacherId: "t-me" });
    const tx = h as unknown as { svc: QuestionBankService };
    // No quiz row in the fake database: the ownership check must come first.
    await tx.svc
      .fromQuiz("s", teacher, {
        quizId: "q1",
        questionIds: ["a"],
        difficulty: "MEDIUM",
        shared: true,
      })
      .catch(() => undefined);
    expect(h.owned).toEqual(["q1"]);
  });
});

describe("a question goes into a quiz as a copy", () => {
  it("hands back no id, so saving the quiz makes new questions", async () => {
    const h = harness({
      rows: [
        {
          id: "b1",
          teacherId: null,
          question: "The sun is a star.",
          questionType: "TRUE_FALSE",
          correctAnswer: "TRUE",
          options: [],
          marks: 1,
        },
      ],
    });
    const out = await h.svc.use("s", admin, { ids: ["b1"] });
    expect(out).toHaveLength(1);
    expect(out[0]).not.toHaveProperty("id");
    expect(out[0].bankItemId).toBe("b1");
    expect(out[0].correctAnswer).toBe("TRUE");
  });

  it("counts the use", async () => {
    const h = harness({ rows: [{ id: "b1", teacherId: null, options: [] }] });
    await h.svc.use("s", admin, { ids: ["b1"] });
    const upd = h.calls.find((c) => c.op === "updateMany")!.args as {
      data: { usageCount: { increment: number } };
    };
    expect(upd.data.usageCount.increment).toBe(1);
  });
});

const SRC = __dirname;
const service = readFileSync(join(SRC, "question-bank.service.ts"), "utf8");
const controller = readFileSync(join(SRC, "question-bank.controller.ts"), "utf8");
const migration = readFileSync(
  join(SRC, "..", "..", "prisma", "migrations", "20260923120000_question_bank", "migration.sql"),
  "utf8",
);
const WEB = join(SRC, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

describe("the wiring", () => {
  it("sanitises what is stored, the same way a quiz question is", () => {
    expect(service).toContain("questionContent(q)");
    expect(service).not.toContain(".delete(");
  });

  it("is isolated per school like every other tenant table", () => {
    expect(migration).toContain('"question_bank_items" ENABLE ROW LEVEL SECURITY');
    expect(migration).toContain('"question_bank_items" FORCE ROW LEVEL SECURITY');
    expect(migration).toContain(
      `USING ("schoolId" = current_setting('app.current_tenant', true))`,
    );
    expect(migration).toContain("TO app_user");
  });

  it("reads 'options' before any route that takes an id", () => {
    expect(controller.indexOf('@Get("options")')).toBeLessThan(
      controller.indexOf('@Patch(":id")'),
    );
  });

  it("replaced the browser-only page", () => {
    const page = read("app", "(app)", "quiz", "question-bank", "page.tsx");
    expect(page).not.toContain("@/lib/quiz/store");
    expect(page).toContain("<BankBrowser");
  });

  it("is open to teachers, in both places they work", () => {
    expect(read("lib", "teachers", "routes.ts")).not.toContain('"/quiz/question-bank"');
    expect(read("lib", "teacher-portal", "routes.ts")).toContain("/teacher-portal/question-bank");
    expect(existsSync(join(WEB, "app", "teacher-portal", "question-bank", "page.tsx"))).toBe(true);
    expect(read("components", "layout", "sidebar.tsx")).toContain('href: "/quiz/question-bank"');
  });

  it("edits a bank question with the quiz builder's own editor and rules", () => {
    const dialog = read("components", "quiz", "bank-item-dialog.tsx");
    expect(dialog).toContain("<QuestionEditor");
    expect(dialog).toContain("questionProblem(q, t)");
  });

  it("adds from the bank and saves to it from the quiz builder", () => {
    const editor = read("app", "(app)", "quiz", "[id]", "page.tsx");
    expect(editor).toContain("<BankPickerDialog");
    expect(editor).toContain("<SaveToBankDialog");
    expect(editor).toContain("copies.map(toBQ)");
  });

  it("has its wording in every language the app speaks", () => {
    for (const f of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
      const d = read("lib", "i18n", "dictionaries", f);
      expect(d).toContain("questionBank: {");
      for (const k of ["addFromBank:", "saveToBank:", "shareWithColleagues:", "diff_HARD:"]) {
        expect(d).toContain(k);
      }
    }
  });
});
