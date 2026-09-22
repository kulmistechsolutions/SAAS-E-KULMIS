import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The teacher can try a quiz, and what they try is what a student sits.
 *
 * The server keeps practice runs apart (practice-separation.spec.ts). This
 * checks the screens: that "Try Quiz" is where a teacher looks for it, that
 * it mounts the student's own screen rather than a look-alike, that nothing
 * on that screen writes an attempt, and that it says plainly on every step
 * that the score is not a result.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

const take = read("components", "quiz", "take-quiz.tsx");
const editor =
  read("app", "(app)", "quiz", "[id]", "page.tsx") +
  // The question editor itself lives in a component shared with the bank.
  readFileSync(join(__dirname, "..", "..", "..", "web", "src", "components", "quiz", "question-editor.tsx"), "utf8");
const results = read("app", "(app)", "quiz", "[id]", "results", "page.tsx");
const marks = read("components", "quiz", "attempt-marks-dialog.tsx");
const teacherList = read("app", "teacher-portal", "quizzes", "page.tsx");
const adminList = read("app", "(app)", "quiz", "list", "page.tsx");

/** The body of one function in the take screen. */
function fn(src: string, name: string): string {
  const start = src.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`no function ${name}`);
  const next = src.indexOf("\n  async function ", start + 10);
  const next2 = src.indexOf("\n  function ", start + 10);
  const ends = [next, next2].filter((i) => i > 0);
  return src.slice(start, ends.length ? Math.min(...ends) : undefined);
}

describe("Try Quiz is where a teacher looks for it", () => {
  it("is on the quiz itself, beside Preview", () => {
    expect(editor).toContain("/practice`}");
    expect(editor).toContain('tr("quizPractice.tryQuiz")');
  });

  it("is on both quiz lists", () => {
    expect(teacherList).toContain("/practice`}");
    expect(adminList).toContain("/practice`}");
  });

  it("has a route in the staff app and in the teacher portal", () => {
    for (const p of [
      ["app", "(app)", "quiz", "[id]", "practice", "page.tsx"],
      ["app", "teacher-portal", "quizzes", "[id]", "practice", "page.tsx"],
    ]) {
      expect(existsSync(join(WEB, ...p))).toBe(true);
    }
  });

  it("refuses to run unsaved edits", () => {
    // Practice serves the saved quiz; testing an edit that is not saved would
    // test something no student will ever get.
    expect(editor).toContain('toast(tr("quizPractice.saveFirst")');
  });
});

describe("the teacher sits the student's own screen", () => {
  it("is one component for both", () => {
    const practiceRoute = read("app", "(app)", "quiz", "[id]", "practice", "page.tsx");
    const studentRoute = read("app", "(app)", "quiz", "take", "[code]", "page.tsx");
    expect(practiceRoute).toContain('from "@/components/quiz/take-quiz"');
    expect(studentRoute).toContain('from "@/components/quiz/take-quiz"');
    expect(take).toContain("export function PracticeQuiz(");
    expect(take).toContain("practiceQuizId={quizId}");
  });

  it("maps the paper through the same function either way", () => {
    expect(take).toContain("mapPaper(practicePaper.paper, access)");
    expect(take).toContain("mapPaper(row, access)");
  });

  it("asks for no Student ID", () => {
    // The practice path goes straight to the instructions; the sign-in step
    // is only ever reached from the student's landing page.
    expect(take).toContain("apiPracticeQuiz(practiceQuizId)");
    expect(take).toContain('studentCode: "PRACTICE"');
  });
});

describe("nothing on the practice path writes a student's attempt", () => {
  it("starts no attempt", () => {
    const start = fn(take, "startQuiz");
    const practiceBranch = start.slice(0, start.indexOf("try {"));
    expect(practiceBranch).toContain("if (practicePaper)");
    expect(practiceBranch).not.toContain("apiStartQuizAttempt");
  });

  it("submits to the practice endpoint and returns before the student one", () => {
    const submit = fn(take, "handleSubmit");
    const practiceBranch = submit.slice(0, submit.indexOf("const payload"));
    expect(practiceBranch).toContain("apiSubmitPracticeQuiz");
    expect(practiceBranch).toContain("return;");
    expect(practiceBranch).not.toContain("apiSubmitQuizAttempt");
  });

  it("autosaves nothing", () => {
    // Autosave and clearing both need an attempt id, which practice never has.
    expect(take).toContain("if (!attemptId || !access || submitted) return;");
  });
});

describe("it says so, on every step", () => {
  it("shows the banner on the instructions, the paper, the result and the review", () => {
    const banners = take.match(/\{practice && <PracticeBanner \/>\}/g) ?? [];
    expect(banners.length).toBeGreaterThanOrEqual(4);
  });

  it("never calls a practice run a PASS or a FAIL", () => {
    expect(take).toContain('tr("quizPractice.practiceOnly")');
    expect(take).toContain('tr("quizPractice.notRecorded")');
  });

  it("offers no result sheet to print", () => {
    // A printed sheet with a school's letterhead on it is the one thing most
    // likely to be mistaken for a real result.
    expect(take).toContain("!practice &&\n                  (result?.quiz.allowPdfDownload");
  });
});

describe("True / False on the student's screen", () => {
  it("shows two buttons that send TRUE or FALSE", () => {
    expect(take).toContain('q.questionType === "TRUE_FALSE" ?');
    expect(take).toContain("selectOption(q.id, v)");
    expect(take).toContain("tfLabels(quiz.language, qDir)");
  });

  it("asks for the word to be written on the written kind", () => {
    expect(take).toContain('q.questionType === "TRUE_FALSE_WRITTEN" ?');
    // An Arabic paper's answer box turns round like every other.
    const at = take.indexOf('q.questionType === "TRUE_FALSE_WRITTEN" ?');
    expect(take.slice(at, at + 900)).toContain("quizFieldProps(");
  });
});

describe("True / False in the editor", () => {
  it("offers both kinds beside Multiple Choice", () => {
    expect(editor).toContain('TRUE_FALSE: "True / False"');
    expect(editor).toContain('TRUE_FALSE_WRITTEN: "True / False — Written"');
    expect(editor).toContain("QTYPES.map((t) =>");
  });

  it("needs no options typed, and starts with an answer chosen", () => {
    expect(editor).toContain('correctAnswer: isTf(type) ? "TRUE" : ""');
  });

  it("lets the school add its own words and shows the built-in ones", () => {
    expect(editor).toContain("TF_DEFAULT_ACCEPTED[side]");
    expect(editor).toContain("acceptedAnswers: { ...q.acceptedAnswers, [side]:");
  });

  it("catches a word on both sides before saving", () => {
    expect(editor).toContain("tfConflicts(q.acceptedAnswers)");
  });

  it("sends the words back and reads them in", () => {
    expect(editor).toContain('q.questionType === "TRUE_FALSE_WRITTEN"\n        ? {');
    expect(editor).toContain("TRUE: q.acceptedAnswers?.TRUE ?? []");
  });
});

describe("a teacher can override a mark", () => {
  it("from the results page", () => {
    expect(results).toContain("<AttemptMarksDialog");
    expect(results).toContain("setMarksFor(a.id)");
  });

  it("either way, with a reason that goes to the audit log", () => {
    expect(marks).toContain("setMarks(q.answerId!, q.maxMarks)");
    expect(marks).toContain("setMarks(q.answerId!, 0)");
    expect(marks).toContain("reason.trim() || undefined");
    expect(marks).toContain('t("quizOverride.audited")');
  });
});

describe("the wording exists in every language the app speaks", () => {
  const keys = [
    "tryQuiz:",
    "banner:",
    "practiceOnly:",
    "notRecorded:",
    "acceptedHint:",
    "writeAnswer:",
    "markCorrect:",
    "markIncorrect:",
    "audited:",
  ];
  for (const file of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
    it(file, () => {
      const dict = read("lib", "i18n", "dictionaries", file);
      for (const ns of ["quizPractice: {", "quizTf: {", "quizOverride: {"]) {
        expect(dict).toContain(ns);
      }
      for (const k of keys) expect(dict).toContain(k);
    });
  }
});
