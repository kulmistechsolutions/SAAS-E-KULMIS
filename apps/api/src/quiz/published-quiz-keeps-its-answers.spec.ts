import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A published quiz is an academic record, not editable content.
 *
 * Saving a quiz deleted every question row and recreated it with fresh ids.
 * Answers are stored against question ids and there is no foreign key to stop
 * it, so an attempt kept its score while the sheet behind it pointed at
 * questions that no longer existed. The teacher saw the quiz they meant; the
 * student saw marks against questions that could not be shown.
 *
 * It had already happened to ninety-four answers across eleven attempts at
 * four schools — ummaddapss, hudeyfaacademy, sinaan, machadalridaa — the most
 * recent the day before this was written. Those questions are gone and cannot
 * be recovered. This is what stops the next one.
 */
const HERE = __dirname;
const service = readFileSync(join(HERE, "quiz.service.ts"), "utf8");
const schema = readFileSync(
  join(HERE, "..", "..", "prisma", "schema.prisma"),
  "utf8",
);
const shared = readFileSync(
  join(HERE, "..", "..", "..", "..", "packages", "shared", "src", "schemas", "quiz.ts"),
  "utf8",
);
const builder = readFileSync(
  join(HERE, "..", "..", "..", "web", "src", "app", "(app)", "quiz", "[id]", "page.tsx"),
  "utf8",
);

describe("saving a quiz no longer deletes its questions", () => {
  it("has no blanket delete left in the save path", () => {
    // The single line that caused it.
    expect(service).not.toContain(
      "await tx.quizQuestion.deleteMany({ where: { quizId } });",
    );
  });

  it("updates a question that already exists, in place", () => {
    expect(service).toContain("if (id && known.has(id)) {");
    expect(service).toContain("tx.quizQuestion.update({ where: { id }, data: body(q, i) })");
  });

  it("creates only what is genuinely new", () => {
    expect(service).toMatch(
      /} else \{[\s\S]{0,160}tx\.quizQuestion\.create\(/,
    );
  });
});

describe("a question somebody answered is never deleted", () => {
  it("asks whether it has answers before removing it", () => {
    expect(service).toContain("tx.quizAnswer.findMany({");
    expect(service).toContain("where: { questionId: { in: dropped } }");
  });

  it("deletes only the ones nobody answered", () => {
    expect(service).toContain(
      "const removable = dropped.filter((id) => !answeredIds.has(id));",
    );
  });

  it("retires the rest instead", () => {
    expect(service).toContain("data: { retiredAt: new Date() }");
    expect(schema).toContain("retiredAt           DateTime?");
  });
});

describe("a retired question leaves the paper but not the record", () => {
  it("is excluded from the questions a student is given", () => {
    expect(service).toContain("where: { retiredAt: null },");
  });

  it("is excluded from the total marks", () => {
    expect(service).toContain(
      "questions: { where: { retiredAt: null }, select: { marks: true } },",
    );
  });

  it("is still there to be read back", () => {
    // Retiring sets a timestamp; nothing removes the row.
    expect(service).not.toContain("quizQuestion.deleteMany({ where: { quizId } })");
  });
});

describe("the id survives the round trip", () => {
  it("is accepted by the schema", () => {
    expect(shared).toContain("id: z.string().min(1).optional(),");
  });

  it("is carried through the editor", () => {
    expect(builder).toContain("id?: string;");
    expect(builder).toContain("id: q.id,");
  });

  it("is sent back only for a question that has one", () => {
    // A new question must not arrive with an id the server would try to match.
    expect(builder).toContain("...(q.id ? { id: q.id } : {}),");
  });
});
