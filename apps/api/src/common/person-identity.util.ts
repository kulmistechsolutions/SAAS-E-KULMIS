/**
 * Comparing people by name, the way a registrar would.
 *
 * Names arrive typed by hand — "ABDIRAHMAAN  ALI ADAN" and "Abdirahmaan Ali
 * Adan" are one person with a stray double space and a different caps lock.
 * A plain string comparison treats them as two, which is how the same student
 * or teacher ends up in the register twice.
 */

/** Lowercase, trimmed, and with runs of whitespace collapsed to one space. */
export function normalizeName(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * Phone numbers as an identity key: digits only, so "+252 61 360 9678",
 * "252613609678" and "0613609678" don't masquerade as three people. The last
 * 9 digits are compared — that is the national number in Somalia, with or
 * without the country code or a leading zero.
 */
export function normalizePhone(
  value: string | null | undefined,
): string | null {
  if (!value) return null;
  const digits = value.replace(/\D/g, "");
  if (!digits) return null;
  return digits.length > 9 ? digits.slice(-9) : digits;
}
