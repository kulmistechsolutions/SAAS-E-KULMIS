"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  DEFAULT_LANG,
  LANG_COOKIE,
  LANG_COOKIE_MAX_AGE,
  dirOf,
  toLang,
  type Lang,
} from "./config";
import {
  en,
  type Dictionary,
  type PartialDictionary,
} from "./dictionaries/en";
import { so } from "./dictionaries/so";
import { ar } from "./dictionaries/ar";

const DICTIONARIES: Record<Lang, PartialDictionary> = { en, so, ar };

/**
 * Every key in the dictionary, as a dotted path — "common.save",
 * "nav.students". Typing them this way means a misspelled key is a build
 * error, not a school reading "nav.studnts" on screen.
 */
type Paths<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown>
    ? `${K}.${Paths<T[K]>}`
    : K;
}[keyof T & string];

export type TranslationKey = Paths<Dictionary>;

export type Translate = (
  key: TranslationKey,
  vars?: Record<string, string | number>,
) => string;

interface I18nValue {
  lang: Lang;
  dir: "ltr" | "rtl";
  setLang: (lang: Lang) => void;
  t: Translate;
}

const I18nContext = createContext<I18nValue | null>(null);

function lookup(dict: PartialDictionary, key: string): string | undefined {
  let node: unknown = dict;
  for (const part of key.split(".")) {
    if (typeof node !== "object" || node === null) return undefined;
    node = (node as Record<string, unknown>)[part];
  }
  return typeof node === "string" ? node : undefined;
}

/** Replaces {name} placeholders — "{count} selected" → "3 selected". */
function fill(text: string, vars?: Record<string, string | number>): string {
  if (!vars) return text;
  return text.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in vars ? String(vars[name]) : whole,
  );
}

/**
 * Reads the language cookie directly, for code that builds HTML outside
 * React — the print/receipt generators open a new window and write markup
 * by hand, so they have no component tree to pull useT() from.
 */
export function getStoredLang(): Lang {
  if (typeof document === "undefined") return DEFAULT_LANG;
  const match = document.cookie.match(new RegExp(`(?:^|; )${LANG_COOKIE}=([^;]+)`));
  return toLang(match?.[1]);
}

/** translate()'s non-hook twin, for the same print/receipt generators. */
export function translateIn(
  lang: Lang,
  key: TranslationKey,
  vars?: Record<string, string | number>,
): string {
  const dict = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG];
  const text = lookup(dict, key) ?? lookup(en, key) ?? key;
  return fill(text, vars);
}

export function I18nProvider({
  initialLang,
  children,
}: {
  initialLang: Lang;
  children: ReactNode;
}) {
  // Seeded from the cookie the server already read, so the first client render
  // matches the HTML it is hydrating and no text flips after load.
  const [lang, setLangState] = useState<Lang>(initialLang);

  // If the server had no cookie to read, it resolved initialLang from the
  // school's own preferred language instead (see RootLayout). Persist that
  // now so the choice sticks — otherwise every subsequent anonymous page load
  // repeats the same server-side lookup instead of just reading the cookie.
  // Never overwrites a cookie that's already there.
  useEffect(() => {
    if (!document.cookie.split("; ").some((c) => c.startsWith(`${LANG_COOKIE}=`))) {
      document.cookie = `${LANG_COOKIE}=${initialLang}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
    }
    // Only ever needs to run once per mount — re-running on `lang` changes
    // would fight setLang's own cookie write.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=${LANG_COOKIE_MAX_AGE}; samesite=lax`;
    // The <html> attributes drive direction and font selection, and React does
    // not own them here — the root layout rendered them on the server.
    document.documentElement.lang = next;
    document.documentElement.dir = dirOf(next);
  }, []);

  const t = useCallback<Translate>(
    (key, vars) => {
      const dict = DICTIONARIES[lang] ?? DICTIONARIES[DEFAULT_LANG];
      // English backs every language: a key not yet translated shows real
      // words rather than a dotted path.
      const text = lookup(dict, key) ?? lookup(en, key) ?? key;
      return fill(text, vars);
    },
    [lang],
  );

  const value = useMemo<I18nValue>(
    () => ({ lang, dir: dirOf(lang), setLang, t }),
    [lang, setLang, t],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

/**
 * Usable outside the provider — portals and standalone pages render their own
 * trees — where it falls back to the default language rather than throwing.
 */
export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  const fallback = useMemo<I18nValue>(
    () => ({
      lang: DEFAULT_LANG,
      dir: dirOf(DEFAULT_LANG),
      setLang: () => {},
      t: (key, vars) => fill(lookup(en, key) ?? key, vars),
    }),
    [],
  );
  return ctx ?? fallback;
}

/** The common case: `const t = useT();` then `t("nav.students")`. */
export function useT(): Translate {
  return useI18n().t;
}
