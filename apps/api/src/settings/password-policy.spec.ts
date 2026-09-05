import {
  DEFAULT_PASSWORD_POLICY,
  passwordPolicyMessage,
} from "@ekulmis/shared";

/**
 * What a school asks of a password out of the box.
 *
 * A capital and a digit were once demanded of every school whether it had
 * asked for them or not, and the rule was written down in three places that
 * disagreed — so an administrator creating an attendance officer was refused
 * a password the server would have accepted. Length is the only default now,
 * and a school that wants more switches it on itself.
 */
describe("the default password rule", () => {
  it("asks for eight characters and nothing else", () => {
    expect(DEFAULT_PASSWORD_POLICY).toEqual({
      minPasswordLength: 8,
      requireComplexity: false,
      requireUppercase: false,
      requireNumber: false,
    });
  });

  it("accepts eight plain lowercase letters", () => {
    expect(passwordPolicyMessage("abcdefgh")).toBeNull();
  });

  it("accepts eight digits", () => {
    expect(passwordPolicyMessage("12345678")).toBeNull();
  });

  it("refuses seven characters, and says how many were typed", () => {
    expect(passwordPolicyMessage("abcdefg")).toBe(
      "Password must be at least 8 characters (this one is 7).",
    );
  });

  it("still enforces a capital and a digit for a school that asks for them", () => {
    const strict = {
      ...DEFAULT_PASSWORD_POLICY,
      requireUppercase: true,
      requireNumber: true,
    };
    expect(passwordPolicyMessage("abcdefgh", strict)).toBe(
      "Password must include a capital letter, and include a number.",
    );
    expect(passwordPolicyMessage("Abcdefg1", strict)).toBeNull();
  });

  it("names every broken rule at once rather than one per attempt", () => {
    // Being sent back three times for one password is what made schools turn
    // the rules off entirely.
    const strict = {
      minPasswordLength: 10,
      requireComplexity: true,
      requireUppercase: true,
      requireNumber: true,
    };
    const message = passwordPolicyMessage("abc", strict) ?? "";
    expect(message).toContain("at least 10 characters");
    expect(message).toContain("capital letter");
    expect(message).toContain("number");
    expect(message).toContain("symbol");
  });
});
