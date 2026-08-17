/**
 * Somali phone numbers, in one canonical form.
 *
 * Numbers were only ever normalised at SMS-send time, so whatever a
 * spreadsheet contained went into the database untouched and the problem
 * surfaced months later as a failed SMS blast. Normalising on the way IN means
 * a bad number is caught by the person importing it, who can still fix it.
 */

/** `061 512 3456`, `+252615123456`, `615123456` → `252615123456`. */
export function normalizeSomaliPhone(phone: string): string {
  let p = String(phone ?? "").replace(/[^\d+]/g, "").trim();
  if (p.startsWith("+")) p = p.slice(1);
  if (p.startsWith("00252")) p = p.slice(2);
  if (p.startsWith("252")) return p;
  if (p.startsWith("0")) p = p.slice(1);
  // Any bare 9-digit local number is a Somali mobile number — an older check
  // only recognised a handful of hardcoded operator prefixes (61/62/63/68/69),
  // so a real number like 666217543 (Somtel/Golis "66") fell through.
  if (p.length === 9) return `252${p}`;
  return p;
}

/**
 * True when the number can actually be delivered to.
 *
 * A Somali mobile is the country code plus a 9-digit local number. The common
 * failures this catches are a 7-digit number whose operator prefix was lost,
 * and two numbers pasted into one cell, which arrives as ~14 digits.
 */
export function isValidSomaliMobile(phone: string): boolean {
  return /^252\d{9}$/.test(normalizeSomaliPhone(phone));
}

/** A short reason a number was rejected, for import error reporting. */
export function phoneProblem(phone: string): string | null {
  const raw = String(phone ?? "").trim();
  if (!raw) return "missing";
  const n = normalizeSomaliPhone(raw);
  if (/^252\d{9}$/.test(n)) return null;
  const digits = n.replace(/\D/g, "");
  if (digits.length < 9) return "too short — the operator prefix looks missing";
  if (digits.length > 12) return "too long — looks like two numbers in one cell";
  return "not a valid Somali mobile number";
}
