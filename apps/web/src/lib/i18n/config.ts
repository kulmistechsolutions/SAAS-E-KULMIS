/**
 * Languages the interface is available in.
 *
 * The choice lives in a cookie rather than localStorage so the server knows it
 * while rendering: `<html lang>` and `<html dir>` are then correct in the first
 * response, and Arabic does not flash left-to-right before React takes over.
 */
export const LANGUAGES = [
  { code: "en", label: "English", native: "English", dir: "ltr" },
  { code: "so", label: "Somali", native: "Soomaali", dir: "ltr" },
  { code: "ar", label: "Arabic", native: "العربية", dir: "rtl" },
] as const;

export type Lang = (typeof LANGUAGES)[number]["code"];
export type Dir = "ltr" | "rtl";

export const DEFAULT_LANG: Lang = "en";

/** Cookie, not localStorage — the server reads this before rendering. */
export const LANG_COOKIE = "ekulmis_lang";

/** A year: the choice should outlast the session that made it. */
export const LANG_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;

export function isLang(value: unknown): value is Lang {
  return LANGUAGES.some((l) => l.code === value);
}

/** Falls back to the default rather than throwing on a stale or edited cookie. */
export function toLang(value: unknown): Lang {
  return isLang(value) ? value : DEFAULT_LANG;
}

export function dirOf(lang: Lang): Dir {
  return LANGUAGES.find((l) => l.code === lang)?.dir ?? "ltr";
}
