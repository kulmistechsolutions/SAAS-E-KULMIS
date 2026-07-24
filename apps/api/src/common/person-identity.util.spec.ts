import { normalizeName, normalizePhone } from "./person-identity.util";

/**
 * These two helpers decide whether two rows are the same person, so the cases
 * below are the ones that actually produced duplicates in a live register:
 * a name typed with a double space, and a phone written with the country code
 * one time and a leading zero the next.
 */

describe("normalizeName", () => {
  it("ignores case", () => {
    expect(normalizeName("ABDIRAHMAAN ALI ADAN")).toBe(
      normalizeName("Abdirahmaan Ali Adan"),
    );
  });

  it("ignores a stray double space", () => {
    // This exact pair sat in production as two teacher records.
    expect(normalizeName("ABDIRAHMAAN  ALI ADAN")).toBe(
      normalizeName("Abdirahmaan Ali Adan"),
    );
  });

  it("ignores leading and trailing whitespace", () => {
    expect(normalizeName("  Saacid Abdi Bashiir \n")).toBe(
      "saacid abdi bashiir",
    );
  });

  it("keeps genuinely different names apart", () => {
    expect(normalizeName("Amina Hassan")).not.toBe(
      normalizeName("Amina Hasan"),
    );
  });
});

describe("normalizePhone", () => {
  it("treats the same number written three ways as one", () => {
    const canonical = normalizePhone("613609678");
    expect(normalizePhone("+252 61 360 9678")).toBe(canonical);
    expect(normalizePhone("252613609678")).toBe(canonical);
    expect(normalizePhone("0613609678")).toBe(canonical);
  });

  it("strips punctuation and spacing", () => {
    expect(normalizePhone("(061) 360-9678")).toBe(normalizePhone("613609678"));
  });

  it("keeps different numbers apart", () => {
    expect(normalizePhone("613609678")).not.toBe(normalizePhone("613609679"));
  });

  it("returns null when there is no number to compare", () => {
    expect(normalizePhone(null)).toBeNull();
    expect(normalizePhone(undefined)).toBeNull();
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("   ")).toBeNull();
    // No digits at all is not a phone number.
    expect(normalizePhone("n/a")).toBeNull();
  });

  it("leaves a short local number as-is rather than truncating it", () => {
    expect(normalizePhone("12345")).toBe("12345");
  });
});
