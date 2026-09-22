import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Arabic has to read as Arabic everywhere the same question appears.
 *
 * Detection and a font list are worth nothing if one screen uses them and the
 * next does not: a question written right-to-left in the editor, answered
 * left-to-right by the student and printed left-to-right on the sheet is
 * worse than no support at all, because the teacher has been told it works.
 *
 * So this checks the wiring rather than the rules — the rules have their own
 * tests in text-direction.spec.ts. Every place a question, an option or an
 * answer is shown or typed must go through the shared component, and the
 * direction must survive the trip from the database to each of them.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

const take = read("components", "quiz", "take-quiz.tsx");
const editor = read("app", "(app)", "quiz", "[id]", "page.tsx");
const live = read("app", "(app)", "quiz", "[id]", "live", "page.tsx");
const printer = read("lib", "quiz", "print.ts");
const api = readFileSync(join(__dirname, "quiz.service.ts"), "utf8");

describe("the student's screen", () => {
  it("renders the question through the shared component", () => {
    expect(take).toContain("QuizText");
    // Not raw: a bare {q.question} is the bug this exists to prevent.
    expect(take).not.toMatch(/>\s*\{q\.question\}\s*</);
  });

  it("turns the boxes a student types into round as well", () => {
    // A left-to-right input taking Arabic puts the cursor on the wrong side
    // and the question mark at the wrong end.
    expect(take).toContain("quizFieldProps");
    const uses = take.match(/quizFieldProps\(/g) ?? [];
    // The direct-answer box, each blank, and the match dropdown.
    expect(uses.length).toBeGreaterThanOrEqual(3);
  });

  it("carries the direction down from the quiz to every question", () => {
    expect(take).toContain("quizDirection={quiz.direction}");
    expect(take).toContain("direction: row.direction ?? null");
    expect(take).toContain("direction: q.direction ?? null");
  });

  it("sets the title and the instructions the same way", () => {
    // The first screen a student sees. These carry no quiz setting of their
    // own — they come from the landing payload — so detection decides, which
    // is right for free text that says what it is.
    expect(take).toContain('text={q.title}');
    expect(take).toContain('text={q.instructions}');
    expect(take).not.toMatch(/>\s*\{q\.instructions\}\s*</);
  });

  it("uses the paper's own direction on the review sheet, not a live quiz", () => {
    // A student opening a past result has no quiz loaded; reading direction
    // off one would have been a crash on the screen parents are shown.
    expect(take).toContain("quizDirection={result.quiz.direction}");
  });
});

describe("the teacher's editor", () => {
  it("offers the language, the direction and the face", () => {
    expect(editor).toContain("QUIZ_LANGUAGES");
    expect(editor).toContain("ARABIC_FONTS");
    expect(editor).toContain('tr("quiz.textDirection")');
  });

  it("lets one question differ from the paper it is on", () => {
    // A single paper legitimately mixes them: Q1 English, Q2 Arabic.
    expect(editor).toContain('tr("quiz.dirAsQuiz")');
    expect(editor).toContain("questionDirection");
  });

  it("sends what was chosen and reads it back", () => {
    expect(editor).toContain("language,");
    expect(editor).toContain("contentFont: contentFont || null");
    expect(editor).toContain("setLanguage(q.language ?? \"AUTO\")");
    // Per question, both ways, or a saved override is lost on the next save.
    expect(editor).toContain("direction: q.direction ?? null");
    expect(editor).toContain("direction: q.direction,");
  });

  it("applies an Arabic paper's direction to the fields as they are typed", () => {
    expect(editor).toContain("quizFieldProps");
    expect(editor).toContain("quizDirectionSetting");
  });
});

describe("the record that leaves the screen", () => {
  it("prints the sheet the way the paper was written", () => {
    expect(printer).toContain("resolveDirection");
    expect(printer).toContain('dir="${dirOf(q)}"');
  });

  it("loads the Arabic face into the print window", () => {
    // The print window loads none of the app's CSS, so without this an
    // Arabic sheet falls back to whatever the machine has.
    expect(printer).toContain("PRINT_FONT_HREF");
    expect(printer).toContain("fonts.googleapis.com");
    for (const id of ["amiri", "cairo", "tajawal"]) {
      expect(printer).toContain(id);
    }
  });

  it("shows the monitor the same text the student saw", () => {
    // RichText resolves direction the same way QuizText does and shows the
    // teacher's formatting as well, so the monitor and the student's screen
    // cannot drift apart.
    expect(live).toContain("RichText");
    expect(live).toContain("quizDirection={review.quiz.direction}");
  });
});

describe("the server", () => {
  it("sends the direction with the paper and with the result", () => {
    expect(api).toContain("contentFont: quiz.contentFont");
    expect(api).toContain("contentFont: attempt.quiz.contentFont");
    expect(api).toContain("direction: q.direction");
  });

  it("resolves the declared language before sending it", () => {
    // Every consumer gets the direction that actually applies, so the screen,
    // the sheet and the printer cannot disagree about an Arabic paper.
    const uses = api.match(/quizDirectionSetting\(/g) ?? [];
    expect(uses.length).toBeGreaterThanOrEqual(2);
  });

  it("stores what the teacher chose", () => {
    for (const field of ["language", "direction", "contentFont"]) {
      expect(api).toContain(`...set("${field}")`);
    }
  });
});

describe("the wording exists in every language the app speaks", () => {
  const keys = [
    "textDirection",
    "dirAuto",
    "dirLtr",
    "dirRtl",
    "dirAsQuiz",
    "arabicFont",
    "fontDefault",
    "directionHint",
    "questionDirection",
    "language_ar",
  ];
  for (const file of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
    it(file, () => {
      const dict = read("lib", "i18n", "dictionaries", file);
      for (const k of keys) expect(dict).toContain(`${k}:`);
    });
  }
});
