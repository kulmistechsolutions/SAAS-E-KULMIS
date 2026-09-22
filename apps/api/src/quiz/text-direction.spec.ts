import {
  ARABIC_FONTS,
  detectDirection,
  fontStack,
  resolveDirection,
  rtlShare,
  quizDirectionSetting,
  QUIZ_LANGUAGES,
} from "@ekulmis/shared";

/**
 * A teacher who types Arabic should not have to find a setting.
 *
 * Direction is detected, so "ما هي عاصمة الصومال؟" reads right-to-left the
 * moment it is typed. It is counted rather than merely sniffed, because a
 * first-strong test gets the mixed cases backwards in both directions — and
 * mixed is what a school in the Horn actually writes.
 */
describe("which way the text runs", () => {
  it("reads plain Arabic right-to-left", () => {
    expect(detectDirection("ما هي عاصمة الصومال؟")).toBe("rtl");
    expect(detectDirection("اختبار الشهري")).toBe("rtl");
  });

  it("reads plain English left-to-right", () => {
    expect(detectDirection("What is the capital of Somalia?")).toBe("ltr");
  });

  it("reads Somali left-to-right", () => {
    expect(detectDirection("Waa maxay caasimadda Soomaaliya?")).toBe("ltr");
  });

  it("keeps an Arabic question Arabic when it carries an English label", () => {
    // "Grade 8" is a label on an Arabic question, not an English sentence.
    expect(detectDirection("Grade 8 — ما هي عاصمة الصومال؟")).toBe("rtl");
  });

  it("keeps an English sentence English when it quotes one Arabic word", () => {
    expect(detectDirection("The Arabic for peace is سلام")).toBe("ltr");
  });

  it("is not thrown by digits or punctuation", () => {
    // Direction follows letters. An Arabic question mark on a sum is a
    // punctuation choice, not a sentence running right-to-left, and Arabic
    // digits are digits.
    expect(detectDirection("5 × 5 = ؟")).toBe("ltr");
    expect(detectDirection("١٢٣")).toBe("ltr");
    // But one Arabic word alongside them settles it.
    expect(detectDirection("الجواب ١٢٣")).toBe("rtl");
  });

  it("falls back to left-to-right for nothing at all", () => {
    for (const empty of ["", "   ", "123", "!!!"]) {
      expect(detectDirection(empty)).toBe("ltr");
    }
  });
});

describe("how much of it is right-to-left", () => {
  it("counts letters, not characters", () => {
    expect(rtlShare("سلام")).toBe(1);
    expect(rtlShare("peace")).toBe(0);
  });

  it("ignores what has no direction of its own", () => {
    // Digits and spaces belong to neither.
    expect(rtlShare("سلام 123")).toBe(1);
  });
});

describe("the school's own choice wins", () => {
  it("forces right-to-left when told to", () => {
    expect(resolveDirection("RTL", "This is English")).toBe("rtl");
  });

  it("forces left-to-right when told to", () => {
    // A transliteration table, a vocabulary list — the teacher knows.
    expect(resolveDirection("LTR", "ما هي عاصمة الصومال؟")).toBe("ltr");
  });

  it("detects when left on auto", () => {
    expect(resolveDirection("AUTO", "ما هي عاصمة الصومال؟")).toBe("rtl");
    expect(resolveDirection(null, "What is 5 x 5?")).toBe("ltr");
    expect(resolveDirection(undefined, "سلام عليكم")).toBe("rtl");
  });
});

describe("the typeface", () => {
  it("offers the faces the handbook asks for", () => {
    const ids = ARABIC_FONTS.map((f) => f.label);
    for (const want of [
      "Noto Sans Arabic",
      "Noto Naskh Arabic",
      "Amiri",
      "Cairo",
      "Tajawal",
    ]) {
      expect(ids).toContain(want);
    }
  });

  it("resolves a chosen face to a real stack", () => {
    expect(fontStack("amiri")).toContain("Amiri");
    expect(fontStack("cairo")).toContain("Cairo");
  });

  it("leaves the page's own font alone when nothing was chosen", () => {
    // The right answer for Latin text, and for a school that never chose.
    expect(fontStack(null)).toBeUndefined();
    expect(fontStack("")).toBeUndefined();
    expect(fontStack("not-a-font")).toBeUndefined();
  });
});

describe("the paper's declared language", () => {
  it("makes an Arabic paper read right-to-left without further setting", () => {
    // A teacher who has said the paper is Arabic has said enough. Asking them
    // to also set the direction is asking the same question twice.
    expect(quizDirectionSetting("ar", "AUTO")).toBe("RTL");
  });

  it("covers a paper with nothing to detect from", () => {
    // Diagrams, numbers, a single "5 × 5 = ؟" — detection has no letters to
    // work with, and without the declared language the paper flips to Latin.
    expect(resolveDirection(quizDirectionSetting("ar", "AUTO"), "5 × 5 = ؟")).toBe(
      "rtl",
    );
    expect(resolveDirection(quizDirectionSetting("AUTO", "AUTO"), "5 × 5 = ؟")).toBe(
      "ltr",
    );
  });

  it("lets an explicit direction beat the language", () => {
    // An Arabic-language paper whose questions are English quotations.
    expect(quizDirectionSetting("ar", "LTR")).toBe("LTR");
    expect(quizDirectionSetting("en", "RTL")).toBe("RTL");
  });

  it("leaves every other language to the text", () => {
    // Somali is written in Latin script and runs left-to-right like English,
    // so declaring it must not change anything.
    for (const lang of ["AUTO", "so", "en", null, undefined]) {
      expect(quizDirectionSetting(lang, "AUTO")).toBe("AUTO");
    }
    expect(resolveDirection(quizDirectionSetting("so", "AUTO"), "Magaalada")).toBe(
      "ltr",
    );
  });

  it("offers the languages the schools here actually teach in", () => {
    expect(QUIZ_LANGUAGES.map((l) => l.id)).toEqual(["AUTO", "so", "en", "ar"]);
  });
});
