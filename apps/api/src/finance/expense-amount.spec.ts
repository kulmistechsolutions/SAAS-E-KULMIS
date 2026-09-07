import { createExpenseSchema, isMoneyToCents } from "@ekulmis/shared";

/**
 * What a school spends is not always a whole unit.
 *
 * Expenses were integers everywhere — column, schema and form — so a school
 * buying chalk for 0.50 had no way to record it and had to write 1 or 0. Fees
 * and salaries stay whole because they are quoted that way; this is only about
 * money actually going out.
 *
 * The line drawn is two decimal places: that is what the column holds, and a
 * third would be rounded away on save without anyone being told, which is the
 * kind of quiet arithmetic this system must never do to a school's ledger.
 */
describe("what an expense may cost", () => {
  const amountOf = (amount: unknown) =>
    createExpenseSchema.safeParse({ title: "Chalk", amount });

  it("accepts cents", () => {
    expect(amountOf(0.5).success).toBe(true);
    expect(amountOf(12.75).success).toBe(true);
    expect(amountOf(0.05).success).toBe(true);
  });

  it("still accepts a whole amount", () => {
    expect(amountOf(150).success).toBe(true);
  });

  it("refuses a third decimal rather than rounding it away", () => {
    const r = amountOf(1.234);
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(r.error.issues[0].message).toMatch(/2 decimal places/);
    }
  });

  it("still refuses zero and less", () => {
    expect(amountOf(0).success).toBe(false);
    expect(amountOf(-5).success).toBe(false);
  });

  describe("the cents rule itself", () => {
    it("admits every one of the hundred cent values", () => {
      // 0.29 * 100 is 28.999999999999996 in binary floating point. An exact
      // comparison would refuse an ordinary 29-cent expense, so the rule is
      // written with a tolerance and this walks the whole range to prove it.
      for (let c = 1; c <= 100; c += 1) {
        expect(isMoneyToCents(c / 100)).toBe(true);
      }
    });

    it("refuses what cannot be held", () => {
      expect(isMoneyToCents(0.001)).toBe(false);
      expect(isMoneyToCents(Number.NaN)).toBe(false);
      expect(isMoneyToCents(Number.POSITIVE_INFINITY)).toBe(false);
    });
  });
});
