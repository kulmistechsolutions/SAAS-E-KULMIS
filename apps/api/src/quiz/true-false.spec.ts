import {
  cleanTfAccepted,
  gradeTrueFalse,
  normalizeTfAnswer,
  quizQuestionSchema,
  resolveTfAnswer,
  TF_DEFAULT_ACCEPTED,
  tfConflicts,
  tfLabels,
} from "@ekulmis/shared";

/**
 * Written True / False: what counts as having written the right word.
 *
 * The rules a student is marked by. Generous about what is not part of the
 * answer — case, spaces, the vowel marks Arabic writing carries or leaves off
 * — and strict about what is: "T" is not TRUE until the school says so.
 */
describe("the answer is read, not matched character for character", () => {
  it("ignores case and surrounding space", () => {
    for (const a of ["TRUE", "True", "true", " TRUE ", "\tTrue\n"]) {
      expect(gradeTrueFalse(a, "TRUE")).toBe(true);
    }
    for (const a of ["FALSE", "False", "false", "  false  "]) {
      expect(gradeTrueFalse(a, "FALSE")).toBe(true);
    }
  });

  it("marks the opposite answer wrong", () => {
    expect(gradeTrueFalse("TRUE", "FALSE")).toBe(false);
    expect(gradeTrueFalse("false", "TRUE")).toBe(false);
  });

  it("does not accept an abbreviation the school has not accepted", () => {
    // The PRD's own example: the system says incorrect, the teacher decides.
    expect(gradeTrueFalse("T", "TRUE")).toBe(false);
    expect(gradeTrueFalse("F", "FALSE")).toBe(false);
    expect(gradeTrueFalse("tru", "TRUE")).toBe(false);
  });

  it("drops a closing full stop or question mark", () => {
    expect(gradeTrueFalse("True.", "TRUE")).toBe(true);
    expect(gradeTrueFalse("false!", "FALSE")).toBe(true);
    expect(gradeTrueFalse("صح.", "TRUE")).toBe(true);
  });

  it("treats a blank or unreadable answer as neither", () => {
    // Null, not FALSE: "maybe" is not the student answering FALSE.
    expect(resolveTfAnswer("")).toBeNull();
    expect(resolveTfAnswer("   ")).toBeNull();
    expect(resolveTfAnswer("maybe")).toBeNull();
    expect(gradeTrueFalse("", "FALSE")).toBe(false);
  });
});

describe("Arabic", () => {
  it("accepts صح and خطأ", () => {
    expect(gradeTrueFalse("صح", "TRUE")).toBe(true);
    expect(gradeTrueFalse("خطأ", "FALSE")).toBe(true);
    expect(gradeTrueFalse("صحيح", "TRUE")).toBe(true);
  });

  it("reads the word the same with or without its marks", () => {
    // Written without the hamza, with vowels, with a stretching stroke.
    expect(gradeTrueFalse("خطا", "FALSE")).toBe(true);
    expect(gradeTrueFalse("صَحّ", "TRUE")).toBe(true);
    expect(gradeTrueFalse("صــح", "TRUE")).toBe(true);
    expect(normalizeTfAnswer("خَطَأ")).toBe(
      normalizeTfAnswer("خطا"),
    );
  });

  it("marks خطأ wrong when the answer is TRUE", () => {
    expect(gradeTrueFalse("خطأ", "TRUE")).toBe(false);
  });
});

describe("Somali", () => {
  it("accepts Run and Been in any case", () => {
    expect(gradeTrueFalse("Run", "TRUE")).toBe(true);
    expect(gradeTrueFalse("RUN", "TRUE")).toBe(true);
    expect(gradeTrueFalse("been", "FALSE")).toBe(true);
    expect(gradeTrueFalse("Been", "TRUE")).toBe(false);
  });
});

describe("no language is forced", () => {
  it("accepts a right answer in any of the three, on any paper", () => {
    // None of these means the opposite in another of the languages, which is
    // the only way accepting them all could make a wrong answer right.
    for (const w of TF_DEFAULT_ACCEPTED.TRUE) expect(resolveTfAnswer(w)).toBe("TRUE");
    for (const w of TF_DEFAULT_ACCEPTED.FALSE) expect(resolveTfAnswer(w)).toBe("FALSE");
  });

  it("has no word on both sides", () => {
    expect(tfConflicts(null)).toEqual([]);
  });
});

describe("the school's own words", () => {
  it("accepts an alternative the school added", () => {
    const extra = { TRUE: ["T", "sax"], FALSE: ["F", "khalad"] };
    expect(gradeTrueFalse("t", "TRUE", extra)).toBe(true);
    expect(gradeTrueFalse("Sax", "TRUE", extra)).toBe(true);
    expect(gradeTrueFalse("KHALAD", "FALSE", extra)).toBe(true);
    expect(gradeTrueFalse("sax", "FALSE", extra)).toBe(false);
  });

  it("does not let an alternative on one question leak to another", () => {
    expect(gradeTrueFalse("sax", "TRUE")).toBe(false);
  });

  it("catches a word accepted for both sides", () => {
    expect(tfConflicts({ TRUE: ["haa"], FALSE: ["haa"] })).toEqual(["haa"]);
    // Including against the built-in words, in another case.
    expect(tfConflicts({ FALSE: ["TRUE"] })).toEqual(["true"]);
  });

  it("reads a word on both sides as saying nothing", () => {
    // So a misconfigured question cannot mark every answer that uses it right.
    expect(resolveTfAnswer("haa", { TRUE: ["haa"], FALSE: ["haa"] })).toBeNull();
  });

  it("cleans the list before it is stored", () => {
    expect(
      cleanTfAccepted({ TRUE: [" sax ", "SAX", "true", "", "T"], FALSE: [] }),
    ).toEqual({ TRUE: ["sax", "T"] });
    expect(cleanTfAccepted({ TRUE: ["true", "Run"] })).toBeNull();
    expect(cleanTfAccepted(null)).toBeNull();
  });
});

describe("the buttons speak the paper's language", () => {
  it("in Arabic, Somali and English", () => {
    expect(tfLabels("ar")).toEqual({ TRUE: "صح", FALSE: "خطأ" });
    expect(tfLabels("so")).toEqual({ TRUE: "Run", FALSE: "Been" });
    expect(tfLabels("en")).toEqual({ TRUE: "True", FALSE: "False" });
  });

  it("follows the text when the paper's language is left on Auto", () => {
    expect(tfLabels("AUTO", "rtl").TRUE).toBe("صح");
    expect(tfLabels("AUTO", "ltr").TRUE).toBe("True");
    // A declared language wins over the direction of one question.
    expect(tfLabels("so", "rtl").TRUE).toBe("Run");
  });

  it("sends TRUE or FALSE whatever the label says", () => {
    // The value behind the button, read back by the same rules.
    expect(gradeTrueFalse("TRUE", "TRUE")).toBe(true);
    expect(gradeTrueFalse("FALSE", "FALSE")).toBe(true);
  });
});

describe("a question the builder will refuse", () => {
  const base = { question: "The sun is a star.", marks: 1 };

  it("needs TRUE or FALSE as its answer", () => {
    for (const questionType of ["TRUE_FALSE", "TRUE_FALSE_WRITTEN"] as const) {
      expect(
        quizQuestionSchema.safeParse({ ...base, questionType, correctAnswer: "TRUE" }).success,
      ).toBe(true);
      expect(
        quizQuestionSchema.safeParse({ ...base, questionType, correctAnswer: "yes" }).success,
      ).toBe(false);
      expect(
        quizQuestionSchema.safeParse({ ...base, questionType, correctAnswer: "" }).success,
      ).toBe(false);
    }
  });

  it("refuses a word accepted for both sides", () => {
    const r = quizQuestionSchema.safeParse({
      ...base,
      questionType: "TRUE_FALSE_WRITTEN",
      correctAnswer: "TRUE",
      acceptedAnswers: { TRUE: ["haa"], FALSE: ["haa"] },
    });
    expect(r.success).toBe(false);
  });

  it("needs no options typed in", () => {
    // The teacher chooses TRUE or FALSE; there is nothing else to enter.
    const r = quizQuestionSchema.safeParse({
      ...base,
      questionType: "TRUE_FALSE",
      correctAnswer: "FALSE",
    });
    expect(r.success).toBe(true);
  });
});
