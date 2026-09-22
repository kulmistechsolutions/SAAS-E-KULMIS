import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The choice has to reach the teacher, or the rules behind it are decoration.
 *
 * A teacher fixing a typo and a teacher rewriting question 5 are doing two
 * different things, and the server can now tell them apart — but only if it is
 * told. The screen is what asks, and it has to ask in terms of what happens to
 * the students who already sat the paper, not in terms of version numbers.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const dialog = readFileSync(
  join(WEB, "components", "quiz", "edit-mode-dialog.tsx"),
  "utf8",
);
const history = readFileSync(
  join(WEB, "components", "quiz", "version-history.tsx"),
  "utf8",
);
const page = readFileSync(
  join(WEB, "app", "(app)", "quiz", "[id]", "page.tsx"),
  "utf8",
);
const dict = readFileSync(
  join(WEB, "lib", "i18n", "dictionaries", "so-generated.ts"),
  "utf8",
);

describe("the teacher is asked, before anything is written", () => {
  it("asks only when students have already sat it and the questions moved", () => {
    expect(page).toContain(
      "if (attemptCount > 0 && questionsDirty && !edit) {",
    );
    expect(page).toContain("setAskEditMode(true);");
  });

  it("does not save until the question is answered", () => {
    // The early return is the whole guard: no answer, no write.
    expect(page).toMatch(
      /setAskEditMode\(true\);[\s\S]{0,120}return;/,
    );
  });

  it("carries the answer into the save", () => {
    expect(page).toContain("editMode: edit.mode");
    expect(page).toContain("editReason: edit.reason");
  });

  it("remembers whether the save was also a publish", () => {
    expect(page).toContain("setPendingPublish(thenPublish);");
    expect(page).toContain("void save(pendingPublish, { mode, reason });");
  });
});

describe("the choice is put in terms of the students", () => {
  it("says what a correction does to sheets already submitted", () => {
    expect(dialog).toContain("quizEditMode.correctionEffect");
    expect(dict).toContain("Ardaydii horay u gashay waxay arkayaan qoraalka la saxay");
  });

  it("says what a new version does instead", () => {
    expect(dialog).toContain("quizEditMode.newVersionEffect");
    expect(dict).toContain("waxay ku hadhayaan su'aalihii ay dhab ahaantii ka jawaabeen");
  });

  it("names how many have sat it, and which version", () => {
    expect(dialog).toContain("quizEditMode.alreadySat");
  });

  it("shows the version the save will produce, on the button", () => {
    expect(dialog).toContain("quizEditMode.save");
    expect(dialog).toContain('.replace("{version}", next)');
  });

  it("asks for a reason", () => {
    expect(dialog).toContain("quizEditMode.reason");
    expect(dialog).toContain("maxLength={300}");
  });
});

describe("the history is readable where the quiz is", () => {
  it("shows both sides of an edited question", () => {
    expect(history).toContain("line-through");
    expect(history).toContain("d.before?.question");
    expect(history).toContain("d.after?.question");
  });

  it("names who changed it, when, and why", () => {
    expect(history).toContain("c.changedByName");
    expect(history).toContain("c.reason");
  });

  it("says how many sat each version", () => {
    expect(history).toContain("data.attemptsByVersion.map");
  });

  it("is not shown for a draft nobody has sat", () => {
    expect(page).toContain('quiz.status !== "DRAFT" && <QuizVersionHistory');
  });
});

describe("the version is visible on the quiz itself", () => {
  it("is shown once published, and not before", () => {
    expect(page).toContain('quiz.status !== "DRAFT" && (');
    expect(page).toContain('v{quiz.version ?? "1.0"}');
  });
});
