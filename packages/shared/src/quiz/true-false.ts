/**
 * True / False, in the languages the schools here teach in.
 *
 * Two question types share these rules. TRUE_FALSE shows two buttons and the
 * answer that comes back is already "TRUE" or "FALSE". TRUE_FALSE_WRITTEN
 * asks the student to write the word, which is a different skill and a
 * different paper — and it means deciding what counts as having written it.
 *
 * The stored correct answer is always the canonical "TRUE" or "FALSE",
 * whatever language the paper is in. What changes with the language is only
 * what the student reads on the buttons and which words are accepted, so a
 * paper can be changed from English to Arabic without every question's answer
 * key having to be re-entered.
 */

export type TfValue = "TRUE" | "FALSE";

export const TF_VALUES: readonly TfValue[] = ["TRUE", "FALSE"];

/**
 * Words that always count, in every language.
 *
 * Accepted whatever the paper's language, because a student who writes the
 * right answer in Arabic on an English paper has still written the right
 * answer — and none of these means the opposite in another of the languages,
 * which is the only way accepting them all could make a wrong answer right.
 *
 * Deliberately short. "T", "sax", "haa" are reasonable things for a student to
 * write and a school may well accept them, but that is the school's call: they
 * are added per question as alternatives, and a teacher can mark a single
 * answer correct by hand. The system should not decide on the school's behalf
 * that an abbreviation is good enough.
 */
export const TF_DEFAULT_ACCEPTED: Readonly<Record<TfValue, readonly string[]>> = {
  TRUE: ["true", "صح", "صحيح", "run"],
  FALSE: ["false", "خطأ", "خاطئ", "been"],
};

/** The school's own extra words, per side. */
export type TfAccepted = Partial<Record<TfValue, string[]>>;

/**
 * An answer, reduced to what it says.
 *
 * Case and surrounding space are not part of the answer, and neither are the
 * marks Arabic writing carries or leaves off: a student who writes خطا
 * without the hamza, or صَحّ with its vowels, has written the same word. A
 * trailing full stop or question mark is dropped for the same reason. Nothing
 * else is changed — "T" stays "t" and is not TRUE unless the school says so.
 */
export function normalizeTfAnswer(input: string | null | undefined): string {
  return (input ?? "")
    .normalize("NFKC")
    .toLowerCase()
    // Arabic short vowels, shadda, sukun and the dagger alif.
    .replace(/[ً-ٰٟ]/g, "")
    // Tatweel, the stretching stroke.
    .replace(/ـ/g, "")
    // Hamza carried on or under an alif, and the madda, read as plain alif.
    .replace(/[آأإٱ]/g, "ا")
    // Hamza on a ya-seat or a waw-seat, written without the hamza.
    .replace(/ئ/g, "ي")
    .replace(/ؤ/g, "و")
    // Ta marbuta and alif maqsura, which are routinely written as their
    // look-alikes.
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    // A closing full stop, exclamation or question mark, Latin or Arabic.
    .replace(/[.!?؟۔،,]+$/u, "")
    .trim();
}

/** Every word that counts for each side, normalised once. */
function acceptedSets(extra?: TfAccepted | null): Record<TfValue, Set<string>> {
  const build = (v: TfValue) =>
    new Set(
      [...TF_DEFAULT_ACCEPTED[v], ...(extra?.[v] ?? [])]
        .map(normalizeTfAnswer)
        .filter(Boolean),
    );
  return { TRUE: build("TRUE"), FALSE: build("FALSE") };
}

/**
 * What a written answer says, or null when it says neither.
 *
 * Null is its own outcome, not FALSE: "maybe" is not the student answering
 * FALSE, and a teacher looking at an override needs to see that the answer
 * was unreadable rather than wrong.
 */
export function resolveTfAnswer(
  answer: string | null | undefined,
  extra?: TfAccepted | null,
): TfValue | null {
  const a = normalizeTfAnswer(answer);
  if (!a) return null;
  // The canonical values themselves always resolve, so the button type and a
  // stored "TRUE" read back the same way.
  if (a === "true") return "TRUE";
  if (a === "false") return "FALSE";
  const sets = acceptedSets(extra);
  const t = sets.TRUE.has(a);
  const f = sets.FALSE.has(a);
  // A word the school accepted on both sides says nothing; refusing it here
  // is what keeps a misconfigured question from marking every answer right.
  if (t && !f) return "TRUE";
  if (f && !t) return "FALSE";
  return null;
}

/** Whether an answer to a True / False question is right. */
export function gradeTrueFalse(
  answer: string | null | undefined,
  correct: string,
  extra?: TfAccepted | null,
): boolean {
  const want = correct === "TRUE" || correct === "FALSE" ? correct : null;
  if (!want) return false;
  return resolveTfAnswer(answer, extra) === want;
}

/**
 * Words the school has accepted as both TRUE and FALSE.
 *
 * Checked when the question is saved, so the mistake is caught by the teacher
 * who made it rather than discovered on a student's result.
 */
export function tfConflicts(extra?: TfAccepted | null): string[] {
  const sets = acceptedSets(extra);
  return [...sets.TRUE].filter((w) => sets.FALSE.has(w));
}

/**
 * What the two buttons say, in the paper's language.
 *
 * Somali papers get Run / Been, Arabic papers صح / خطأ; anything else, and a
 * paper left on Auto that is not Arabic, gets True / False. The value behind
 * the button is the same in every case.
 */
export function tfLabels(
  language?: string | null,
  direction?: "ltr" | "rtl" | null,
): Record<TfValue, string> {
  if (language === "ar" || (language !== "so" && language !== "en" && direction === "rtl")) {
    return { TRUE: "صح", FALSE: "خطأ" };
  }
  if (language === "so") return { TRUE: "Run", FALSE: "Been" };
  return { TRUE: "True", FALSE: "False" };
}

/** Clean the school's extra words before they are stored. */
export function cleanTfAccepted(extra?: TfAccepted | null): TfAccepted | null {
  if (!extra) return null;
  const out: TfAccepted = {};
  for (const v of TF_VALUES) {
    const seen = new Set<string>();
    const words: string[] = [];
    for (const raw of extra[v] ?? []) {
      const w = raw.trim();
      const key = normalizeTfAnswer(w);
      // Nothing, or something the defaults already cover.
      if (!key || seen.has(key)) continue;
      if (TF_DEFAULT_ACCEPTED[v].some((d) => normalizeTfAnswer(d) === key)) continue;
      seen.add(key);
      words.push(w.slice(0, 60));
    }
    if (words.length) out[v] = words.slice(0, 20);
  }
  return out.TRUE || out.FALSE ? out : null;
}
