"use client";

/**
 * Which design a document prints in.
 *
 * The data belongs to the system; the design belongs to the school. Nothing
 * here decides an amount, a balance or a date — it decides only which layout
 * receives them, so a school can change how its paper looks without any risk
 * to what the paper says.
 *
 * Stored per browser, like the paper size beside it. A desk prints from the
 * same machine every day, and this needs no server round-trip to be right.
 */

export type DocTemplate = "CLASSIC" | "PREMIUM";

export const DOC_TEMPLATES: {
  id: DocTemplate;
  labelKey: string;
  descriptionKey: string;
}[] = [
  {
    id: "CLASSIC",
    labelKey: "printTemplate.classic",
    descriptionKey: "printTemplate.classicNote",
  },
  {
    id: "PREMIUM",
    labelKey: "printTemplate.premium",
    descriptionKey: "printTemplate.premiumNote",
  },
];

const KEY = "ekulmis.print.template";

export function getStoredTemplate(): DocTemplate {
  if (typeof window === "undefined") return "PREMIUM";
  try {
    const v = window.localStorage.getItem(KEY);
    return v === "CLASSIC" || v === "PREMIUM" ? v : "PREMIUM";
  } catch {
    // Private windows and blocked site data both throw. A default beats a
    // broken print button.
    return "PREMIUM";
  }
}

export function setStoredTemplate(t: DocTemplate) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, t);
  } catch {
    /* not worth failing a print over */
  }
}
