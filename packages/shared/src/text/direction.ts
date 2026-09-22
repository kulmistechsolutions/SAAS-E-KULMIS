/**
 * Which way a piece of text runs, and which typeface it needs.
 *
 * A teacher who types "ما هي عاصمة الصومال؟" should not then have to find a
 * setting to make it read right-to-left. The question is Arabic; the screen
 * can see that. So direction is detected by default and only overridden when
 * a school says otherwise — which it sometimes must, because a question can
 * be mostly English with an Arabic quotation in it, or the reverse, and only
 * the teacher knows which way the sentence is meant to run.
 *
 * Shared, because the same answer has to come out in the editor, on the
 * student's screen, in the preview and on the printed result. A question that
 * reads one way while being written and another way while being answered is
 * worse than one that never supported Arabic at all.
 */

export type TextDirection = "ltr" | "rtl";
export type DirectionSetting = "AUTO" | "LTR" | "RTL";

/**
 * Ranges that are written right-to-left.
 *
 * Arabic and its supplements and presentation forms, plus Hebrew, Syriac and
 * Thaana — a school system used across the Horn will meet Arabic, and there is
 * no reason to be wrong about the rest.
 */
const RTL_RANGES =
  /[\u0590-\u05FF\u0600-\u06FF\u0700-\u074F\u0750-\u077F\u0780-\u07BF\u08A0-\u08FF\uFB1D-\uFDFF\uFE70-\uFEFF]/;

/** Letters that are written left-to-right — Latin, Greek, Cyrillic. */
const LTR_RANGES =
  /[\u0041-\u005A\u0061-\u007A\u00C0-\u024F\u0370-\u03FF\u0400-\u04FF]/;

/**
 * Arabic-script punctuation and digits, which say nothing about direction.
 *
 * Direction follows letters. The Arabic question mark in "5 × 5 = ؟" is a
 * punctuation choice, not a sentence running right-to-left, and counting it
 * as a letter turned a sum into an Arabic question.
 */
const RTL_NEUTRAL =
  /[\u0600-\u0605\u060C\u061B\u061F\u0660-\u0669\u066A-\u066D\u06D4\u06F0-\u06F9]/;

/**
 * How much of the text is right-to-left, ignoring digits and punctuation.
 *
 * Counted rather than merely detected: "Grade 8 — ما هي عاصمة الصومال؟" is an
 * Arabic question with an English label on it and should run right-to-left,
 * while "The Arabic for peace is سلام" is an English sentence with one Arabic
 * word and should not. A first-strong test gets both of those wrong.
 */
export function rtlShare(text: string): number {
  let rtl = 0;
  let ltr = 0;
  for (const ch of text ?? "") {
    if (RTL_NEUTRAL.test(ch)) continue;
    if (RTL_RANGES.test(ch)) rtl += 1;
    else if (LTR_RANGES.test(ch)) ltr += 1;
  }
  const total = rtl + ltr;
  return total === 0 ? 0 : rtl / total;
}

/**
 * Which way this text runs.
 *
 * The threshold is deliberately below half. A right-to-left sentence carries
 * more incidental Latin than a left-to-right one carries Arabic — product
 * names, numbers with units, a subject code — so the tipping point sits where
 * a genuinely Arabic question still wins with a third of its letters Latin.
 */
export function detectDirection(text: string): TextDirection {
  return rtlShare(text) >= 0.35 ? "rtl" : "ltr";
}

/** The setting, resolved against the text it applies to. */
export function resolveDirection(
  setting: DirectionSetting | null | undefined,
  text: string,
): TextDirection {
  if (setting === "RTL") return "rtl";
  if (setting === "LTR") return "ltr";
  return detectDirection(text);
}

/**
 * The typefaces a school may choose for Arabic content.
 *
 * Arabic set in a Latin UI font falls back to whatever the device has, which
 * on a cheap Android phone is frequently a face with no proper Naskh forms —
 * the letters join wrongly and a teacher's carefully typed question looks
 * amateur. Each of these is a real Arabic face with the joining behaviour the
 * script needs.
 */
export const ARABIC_FONTS = [
  { id: "noto-sans-arabic", label: "Noto Sans Arabic", stack: '"Noto Sans Arabic", sans-serif' },
  { id: "noto-naskh-arabic", label: "Noto Naskh Arabic", stack: '"Noto Naskh Arabic", serif' },
  { id: "amiri", label: "Amiri", stack: '"Amiri", serif' },
  { id: "cairo", label: "Cairo", stack: '"Cairo", sans-serif' },
  { id: "tajawal", label: "Tajawal", stack: '"Tajawal", sans-serif' },
] as const;

export type ArabicFontId = (typeof ARABIC_FONTS)[number]["id"];

/**
 * The CSS font-family for a chosen face, or nothing.
 *
 * Nothing means the page's own font, which is the right answer for Latin text
 * and for a school that never chose one.
 */
export function fontStack(id: string | null | undefined): string | undefined {
  if (!id) return undefined;
  return ARABIC_FONTS.find((f) => f.id === id)?.stack;
}

/**
 * The languages a paper can be declared to be in.
 *
 * "Auto" is the default and means the text decides, which is right for almost
 * every paper — including a Somali one, since Somali is written in Latin
 * script and runs left-to-right like English. Declaring the language matters
 * for Arabic, where a paper can legitimately consist of a diagram, a number
 * and nothing else to detect from.
 */
export const QUIZ_LANGUAGES = [
  { id: "AUTO", label: "Auto-detect" },
  { id: "so", label: "Somali" },
  { id: "en", label: "English" },
  { id: "ar", label: "Arabic" },
] as const;

/**
 * The direction setting a quiz actually carries, language included.
 *
 * A teacher who says the paper is Arabic has said enough; they should not
 * then have to set the direction as well. So an Arabic paper left on Auto is
 * right-to-left, and everything else is left for the text to decide.
 */
export function quizDirectionSetting(
  language: string | null | undefined,
  direction: DirectionSetting | null | undefined,
): DirectionSetting {
  if (direction === "LTR" || direction === "RTL") return direction;
  return language === "ar" ? "RTL" : "AUTO";
}
