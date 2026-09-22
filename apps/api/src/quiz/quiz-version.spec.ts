import {
  diffQuestions,
  formatVersion,
  needsReplacement,
  nextVersion,
  parseVersion,
  summarise,
  type QuestionLike,
} from "./quiz-version";

function q(over: Partial<QuestionLike> & { id: string }): QuestionLike & { id: string } {
  return {
    question: "What is 5 x 5?",
    questionType: "MCQ",
    options: ["10", "20", "25", "30"],
    correctAnswer: "25",
    marks: 2,
    pairs: [],
    blanks: [],
    ...over,
  };
}

describe("reading and writing a version", () => {
  it("reads one", () => {
    expect(parseVersion("1.4")).toEqual({ major: 1, minor: 4 });
    expect(parseVersion("12.0")).toEqual({ major: 12, minor: 0 });
  });

  it("starts at 1.0 for anything it cannot read", () => {
    // A row written before versions existed, or edited by hand.
    for (const bad of [null, undefined, "", "v2", "1", "1.2.3", "abc"]) {
      expect(parseVersion(bad)).toEqual({ major: 1, minor: 0 });
    }
  });

  it("writes one back", () => {
    expect(formatVersion(2, 0)).toBe("2.0");
  });
});

describe("which version an edit produces", () => {
  it("moves the minor number for a correction", () => {
    expect(nextVersion("1.0", "CORRECTION", { published: true })).toBe("1.1");
    expect(nextVersion("1.9", "CORRECTION", { published: true })).toBe("1.10");
  });

  it("moves the major number for a new version, and resets the minor", () => {
    // 2.0 is a different paper, not 1.7 with one more fix on it.
    expect(nextVersion("1.7", "NEW_VERSION", { published: true })).toBe("2.0");
  });

  it("leaves a draft alone", () => {
    // Nobody has sat it, so this edit is indistinguishable from writing the
    // quiz in the first place. A draft that reached 1.9 before publication
    // would tell the school nothing.
    expect(nextVersion("1.0", "CORRECTION", { published: false })).toBe("1.0");
    expect(nextVersion("1.0", "NEW_VERSION", { published: false })).toBe("1.0");
  });
});

describe("what changed", () => {
  it("says nothing changed when nothing did", () => {
    const before = [q({ id: "a" })];
    const diff = diffQuestions(before, [q({ id: "a" })]);
    expect(diff[0]!.kind).toBe("UNCHANGED");
    expect(summarise(diff)).toBe("No question changes");
  });

  it("names the fields that moved", () => {
    const diff = diffQuestions(
      [q({ id: "a" })],
      [q({ id: "a", question: "What is 6 x 5?", correctAnswer: "30" })],
    );
    expect(diff[0]!.kind).toBe("EDITED");
    expect(diff[0]!.fields.sort()).toEqual(["correctAnswer", "question"]);
  });

  it("keeps both sides, so the history reads as before and after", () => {
    const diff = diffQuestions(
      [q({ id: "a" })],
      [q({ id: "a", question: "What is 6 x 5?" })],
    );
    expect(diff[0]!.before!.question).toBe("What is 5 x 5?");
    expect(diff[0]!.after!.question).toBe("What is 6 x 5?");
  });

  it("sees a question added and one removed", () => {
    const diff = diffQuestions([q({ id: "a" })], [q({ id: "b" } as never)]);
    // "b" has no matching row, so it is new; "a" is gone.
    expect(diff.map((d) => d.kind).sort()).toEqual(["ADDED", "REMOVED"]);
  });

  it("treats a question with no id as new", () => {
    const diff = diffQuestions([], [q({ id: undefined as never })]);
    expect(diff[0]!.kind).toBe("ADDED");
  });

  it("summarises for a person, not a machine", () => {
    const diff = diffQuestions(
      [q({ id: "a" }), q({ id: "b" })],
      [q({ id: "a", question: "changed" })],
    );
    expect(summarise(diff)).toBe("1 question edited, 1 removed");
  });
});

describe("which edits force a replacement question", () => {
  const edited = (over: Partial<QuestionLike>) =>
    diffQuestions([q({ id: "a" })], [q({ id: "a", ...over })])[0]!;

  it("does, when what it asks changes", () => {
    expect(needsReplacement(edited({ question: "What is 6 x 5?" }))).toBe(true);
  });

  it("does, when what counts as right changes", () => {
    expect(needsReplacement(edited({ correctAnswer: "30" }))).toBe(true);
  });

  it("does, when the choices change", () => {
    expect(needsReplacement(edited({ options: ["1", "2"] }))).toBe(true);
  });

  it("does not, for marks alone", () => {
    // The same question, worth more. Re-creating it would strand every answer
    // to it for no reason.
    expect(needsReplacement(edited({ marks: 3 }))).toBe(false);
  });

  it("does not, for a question nobody touched", () => {
    expect(needsReplacement(edited({}))).toBe(false);
  });

  it("does not, for one that was added or removed", () => {
    const diff = diffQuestions([q({ id: "a" })], []);
    expect(needsReplacement(diff[0]!)).toBe(false);
  });
});
