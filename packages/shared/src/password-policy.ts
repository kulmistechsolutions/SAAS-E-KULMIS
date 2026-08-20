/**
 * A school's password rules, from Settings → Security.
 *
 * These apply to passwords a PERSON chooses — signing up a user, changing
 * your own, an admin typing a replacement. They deliberately do not apply to
 * the ones the system generates for itself (a student's ID as their first
 * portal password, a school's default parent password): those are issued, not
 * chosen, and holding them to a length rule would block registration
 * entirely for something nobody typed.
 */
export interface PasswordPolicy {
  minPasswordLength: number;
  requireComplexity: boolean;
  requireUppercase: boolean;
  requireNumber: boolean;
}

/** Applied when a school has not set its own — matches the settings seed. */
export const DEFAULT_PASSWORD_POLICY: PasswordPolicy = {
  minPasswordLength: 8,
  requireComplexity: true,
  requireUppercase: true,
  requireNumber: true,
};

/**
 * Every rule the password breaks, worded for the person typing it.
 *
 * Returns all of them rather than stopping at the first, so someone is not
 * sent back three times over for one password.
 */
export function passwordPolicyIssues(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string[] {
  const issues: string[] = [];
  if (password.length < policy.minPasswordLength) {
    issues.push(
      `be at least ${policy.minPasswordLength} characters (this one is ${password.length})`,
    );
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    issues.push("include a capital letter");
  }
  if (policy.requireNumber && !/\d/.test(password)) {
    issues.push("include a number");
  }
  // "Complexity" on top of the explicit letter/number switches means a
  // symbol — the rule people expect from that label.
  if (policy.requireComplexity && !/[^A-Za-z0-9]/.test(password)) {
    issues.push("include a symbol such as ! ? or #");
  }
  return issues;
}

/** One sentence naming everything wrong, or null when the password is fine. */
export function passwordPolicyMessage(
  password: string,
  policy: PasswordPolicy = DEFAULT_PASSWORD_POLICY,
): string | null {
  const issues = passwordPolicyIssues(password, policy);
  if (issues.length === 0) return null;
  return `Password must ${issues.join(", and ")}.`;
}
