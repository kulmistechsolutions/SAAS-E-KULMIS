import { verifyPassword } from "./password.util";

/**
 * What an admin can be shown of someone's password.
 *
 * Passwords are stored one-way (scrypt), so the system can never read one
 * back — and must not, for a password the person chose for themselves. What
 * it can do is check whether the login still opens with a password the
 * school itself handed out (the student ID, the shared 12345). If it does,
 * that password is the school's own knowledge and is shown; if not, the
 * person has changed it and the honest answer is "changed — reset it".
 */
export type PasswordReveal =
  | { known: true; password: string; isDefault: true }
  | { known: false; isDefault: false };

export async function revealIssuedPassword(
  stored: string | null | undefined,
  candidates: Array<string | null | undefined>,
): Promise<PasswordReveal> {
  if (stored) {
    const seen = new Set<string>();
    for (const c of candidates) {
      const pw = c?.trim();
      if (!pw || seen.has(pw)) continue;
      seen.add(pw);
      if (await verifyPassword(pw, stored)) {
        return { known: true, password: pw, isDefault: true };
      }
    }
  }
  return { known: false, isDefault: false };
}
