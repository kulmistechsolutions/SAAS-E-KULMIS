import { strandedByReversal } from "./fees.service";

/**
 * What a reversal must clear up after itself.
 *
 * Paying ahead raises a charge for a future month so the advance has somewhere
 * to sit. Reversing the payment returned the money and left that charge
 * standing at nothing paid, so the family was shown a debt for a month their
 * school has never billed — created by the act that was supposed to undo one.
 * Two schools acquired one on the same day this was found, and a third and
 * fourth had older ones.
 *
 * The rule has to cut in exactly one direction. Voiding too little leaves the
 * invented debt; voiding too much erases a month the school genuinely bills,
 * which is money it will never ask for and never know it lost.
 */
describe("a charge left behind by a reversal", () => {
  const advanceCharge = { kind: "MONTHLY", paidAmount: 0, status: "UNPAID" };

  it("is cleared when the school never set that month up", () => {
    // The live case: an advance raised November, the payment came back, and
    // November is not a month this school bills.
    expect(strandedByReversal(advanceCharge, false)).toBe(true);
  });

  it("is kept when the school does bill that month", () => {
    // The school's own obligation. It survives any payment being undone —
    // erasing it would be money the school never asks for again.
    expect(strandedByReversal(advanceCharge, true)).toBe(false);
  });

  it("is kept while any money is still on it", () => {
    // A partly-undone charge is still settling something.
    expect(
      strandedByReversal(
        { kind: "MONTHLY", paidAmount: 5, status: "PARTIAL" },
        false,
      ),
    ).toBe(false);
  });

  it("never touches a one-off fee", () => {
    // An exam or admission fee was billed deliberately and stands on its own,
    // whoever paid it or unpaid it.
    for (const kind of ["EXTRA", "REGISTRATION"]) {
      expect(strandedByReversal({ kind, paidAmount: 0, status: "UNPAID" }, false)).toBe(
        false,
      );
    }
  });

  it("does nothing to a charge already voided", () => {
    // So reversing twice, or unwinding one charge through two allocations,
    // changes nothing the second time.
    expect(
      strandedByReversal(
        { kind: "MONTHLY", paidAmount: 0, status: "INACTIVE" },
        false,
      ),
    ).toBe(false);
  });
});
