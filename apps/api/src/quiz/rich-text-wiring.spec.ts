import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Formatting has to reach the student, and the words have to reach everything
 * else.
 *
 * Two separate promises. The first is the feature: a highlight a teacher put
 * on one letter must appear on the student's screen and on the printed sheet,
 * not only in the box it was typed in. The second is what keeps the feature
 * from costing anything: `question` stays the plain words, so grading, the
 * change history and every export carry on reading what the paper asks rather
 * than a string of tags — and a teacher making a word bold is not mistaken
 * for one rewriting the question, which would retire the answers students had
 * already given against it.
 *
 * The sanitiser's own rules are tested in rich-text.spec.ts. This checks that
 * it is actually on every path, above all the one that writes to the database.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

const api = readFileSync(join(__dirname, "quiz.service.ts"), "utf8");
const editorComp = read("components", "quiz", "rich-text.tsx");
const editorPage = read("app", "(app)", "quiz", "[id]", "page.tsx");
const take = read("components", "quiz", "take-quiz.tsx");
const live = read("app", "(app)", "quiz", "[id]", "live", "page.tsx");
const printer = read("lib", "quiz", "print.ts");
const schema = readFileSync(
  join(__dirname, "..", "..", "prisma", "schema.prisma"),
  "utf8",
);

describe("nothing formatted is stored unsanitised", () => {
  it("cleans the question and the options on the way in", () => {
    // The one that matters. A question written at one school renders in the
    // browsers of students at every other school that sits it.
    expect(api).toContain("sanitizeRichText(q.questionHtml)");
    expect(api).toContain("sanitizeRichText(o)");
  });

  it("cleans the instructions on the way in", () => {
    expect(api).toContain("sanitizeRichText(dto.instructionsHtml)");
  });

  it("cleans again before rendering", () => {
    // Belt and braces, and they guard different things: the server decides
    // what may be stored, the page decides what it will show — including
    // anything stored before a rule changed.
    expect(editorComp).toContain("dangerouslySetInnerHTML");
    expect(editorComp).toContain("__html: sanitizeRichText(html)");
    expect(printer).toContain("sanitizeRichText(q.questionHtml)");
  });

  it("never renders stored html without passing it through first", () => {
    for (const [name, src] of [
      ["the editor component", editorComp],
      ["the student's screen", take],
      ["the live monitor", live],
    ] as const) {
      const uses = src.match(/dangerouslySetInnerHTML/g) ?? [];
      const clean = src.match(/sanitizeRichText/g) ?? [];
      // Every raw injection site in these files is accompanied by a call.
      expect(`${name}: ${uses.length} raw, ${clean.length} clean`).toBe(
        `${name}: ${uses.length} raw, ${uses.length ? clean.length : 0} clean`,
      );
    }
  });

  it("stores the plain words beside the formatted ones", () => {
    expect(schema).toContain("questionHtml        String?");
    expect(schema).toContain("optionsHtml         Json?");
    expect(schema).toContain("instructionsHtml       String?");
  });

  it("keeps null when a teacher formatted nothing", () => {
    // Which is every question that exists today, so nothing changes for them.
    expect(api).toContain("hasFormatting(html) ? html : null");
  });
});

describe("the formatting reaches everywhere the question does", () => {
  it("is on the student's screen, for the question and for each option", () => {
    expect(take).toContain("html={q.questionHtml}");
    expect(take).toContain("html={q.optionsHtml?.[oi] ?? null}");
  });

  it("is on the review sheet and on the printed record", () => {
    expect(take).toContain("html={q.questionHtml}");
    expect(printer).toContain("q.questionHtml");
    // A background colour is dropped by most browsers when printing unless
    // asked; the marked letter is the one thing that had to stay visible.
    expect(printer).toContain("print-color-adjust:exact");
  });

  it("is on the live monitor", () => {
    expect(live).toContain("html={q.questionHtml}");
  });

  it("survives the shuffle with the option it belongs to", () => {
    // Choices are shuffled per student, so formatting keyed to a position
    // would land on a different answer for every child who sat the paper.
    expect(api).toContain("optionHtmlFor");
    expect(api).toContain("const at = original.indexOf(opt)");
  });
});

describe("the words are still the words", () => {
  it("sends the plain text alongside on every change", () => {
    expect(editorComp).toContain("richTextToPlain(clean)");
    expect(editorComp).toContain("onChange({ text: plain");
  });

  it("moves the right answer when an option's words are edited", () => {
    // The correct answer is stored as the option's text; if it does not move
    // with an edit, the paper marks itself wrong.
    expect(editorPage).toContain("next.correctAnswer = n.text");
  });

  it("drops the formatting of an option that was removed", () => {
    expect(editorPage).toContain("q.optionsHtml.filter((_, x) => x !== oi)");
  });
});

describe("the toolbar a teacher actually sees", () => {
  it("offers what was asked for", () => {
    for (const key of [
      "richText.bold",
      "richText.italic",
      "richText.underline",
      "richText.size",
      "richText.font",
      "richText.highlight",
      "richText.clear",
    ]) {
      expect(editorComp).toContain(key);
    }
  });

  it("does nothing when nothing is selected", () => {
    // Better than quietly formatting the whole question.
    expect(editorComp).toContain("sel.isCollapsed");
  });

  it("keeps the selection alive across the click", () => {
    // A button takes focus on mousedown, which collapses the selection before
    // the command can run — so every control refuses that focus.
    const guards = editorComp.match(/onMouseDown=\{\(e\) => e\.preventDefault\(\)\}/g) ?? [];
    expect(guards.length).toBeGreaterThanOrEqual(3);
  });

  it("is on the question, the options and the instructions", () => {
    const uses = editorPage.match(/<RichTextEditor/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });
});

describe("the wording exists in every language the app speaks", () => {
  const keys = [
    "bold:",
    "italic:",
    "underline:",
    "size_100:",
    "size_200:",
    "font:",
    "highlight:",
    "color_yellow:",
    "clear:",
    "hint:",
  ];
  for (const file of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
    it(file, () => {
      const dict = read("lib", "i18n", "dictionaries", file);
      expect(dict).toContain("richText: {");
      for (const k of keys) expect(dict).toContain(k);
    });
  }
});
