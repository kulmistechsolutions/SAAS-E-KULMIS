import type { PartialDictionary } from "./en";

/**
 * Merge one namespace at a time. A plain spread replaces a whole namespace,
 * so a curated `students` block would drop every generated key under it —
 * the screens would half-revert to English for no visible reason.
 */
export function mergeDictionaries(
  base: PartialDictionary,
  overrides: PartialDictionary,
): PartialDictionary {
  const out: Record<string, unknown> = { ...base };
  for (const [ns, values] of Object.entries(overrides)) {
    const existing = out[ns];
    out[ns] =
      existing && typeof existing === "object" && typeof values === "object"
        ? { ...(existing as object), ...(values as object) }
        : values;
  }
  return out as PartialDictionary;
}
