import {
  CustomQuoteError,
  customSmsEnabled,
  quoteCustomSms,
  type CustomSmsRate,
} from "./sms-custom-quote";

/**
 * The price of a custom SMS order.
 *
 * It is charged to a mobile wallet, so it is computed on the server and never
 * accepted from the browser. These cases are the ones a school actually hits:
 * the round numbers, the awkward ones, and the two ends of the range.
 */
const RATE: CustomSmsRate = {
  pricePerSms: 0.025,
  minSms: 50,
  maxSms: 20000,
  currency: "USD",
};

describe("quoting a custom SMS amount", () => {
  it("prices the standard quantities exactly as the packages do", () => {
    // The published packages: 50/$1.25, 100/$2.50, 250/$6.25, 500/$12.50,
    // 1000/$25. A custom amount must not undercut or overcharge them.
    expect(quoteCustomSms(50, RATE).amount).toBe(1.25);
    expect(quoteCustomSms(100, RATE).amount).toBe(2.5);
    expect(quoteCustomSms(250, RATE).amount).toBe(6.25);
    expect(quoteCustomSms(500, RATE).amount).toBe(12.5);
    expect(quoteCustomSms(1000, RATE).amount).toBe(25);
  });

  it("rounds an awkward quantity up to the cent", () => {
    // 643 x 0.025 = 16.075. Rounding down would give away a fraction of a
    // message on every such order.
    expect(quoteCustomSms(643, RATE).amount).toBe(16.08);
  });

  it("refuses less than the floor and more than the ceiling", () => {
    expect(() => quoteCustomSms(49, RATE)).toThrow(CustomQuoteError);
    expect(() => quoteCustomSms(20001, RATE)).toThrow(CustomQuoteError);
    expect(quoteCustomSms(50, RATE).credits).toBe(50);
    expect(quoteCustomSms(20000, RATE).credits).toBe(20000);
  });

  it("refuses a fraction of a message", () => {
    expect(() => quoteCustomSms(10.5, RATE)).toThrow(CustomQuoteError);
    expect(() => quoteCustomSms(0, RATE)).toThrow(CustomQuoteError);
    expect(() => quoteCustomSms(-100, RATE)).toThrow(CustomQuoteError);
  });

  it("is off until the platform sets a rate", () => {
    const off = { ...RATE, pricePerSms: null };
    expect(customSmsEnabled(off)).toBe(false);
    expect(() => quoteCustomSms(100, off)).toThrow(CustomQuoteError);

    // A zero rate is not "free SMS", it is an unset rate.
    const zero = { ...RATE, pricePerSms: 0 };
    expect(customSmsEnabled(zero)).toBe(false);
    expect(() => quoteCustomSms(100, zero)).toThrow(CustomQuoteError);
  });

  it("never quotes nothing for a real order", () => {
    const tiny = { ...RATE, pricePerSms: 0.0001, minSms: 1 };
    expect(quoteCustomSms(1, tiny).amount).toBeGreaterThan(0);
  });

  it("carries the platform's currency, not a guess", () => {
    expect(quoteCustomSms(100, { ...RATE, currency: "SOS" }).currency).toBe("SOS");
    expect(quoteCustomSms(100, { ...RATE, currency: "" }).currency).toBe("USD");
  });
});
