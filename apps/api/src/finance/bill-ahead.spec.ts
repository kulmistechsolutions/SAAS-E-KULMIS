import { mayBillAhead } from "./fees.service";

/**
 * A payment that still has money in hand after settling what it was aimed at
 * used to roll into the next calendar month and bill it — whatever the desk had
 * asked for. That is how a family at HANUUNIYE was handed a receipt for
 * October 2026 on 10 September, for a month the school had only opened as far
 * as September, and with the rest of the class never billed for it.
 */
describe("mayBillAhead", () => {
  it("lets an advance payment bill months ahead", () => {
    // The one type where the desk has said, in as many words, that it is
    // taking money for months that have not been billed yet.
    expect(mayBillAhead("ADVANCE")).toBe(true);
  });

  it("does not let this month's payment bill next month", () => {
    expect(mayBillAhead("THIS_MONTH")).toBe(false);
  });

  it("does not let a partial payment bill next month", () => {
    expect(mayBillAhead("PARTIAL")).toBe(false);
  });

  it("does not let a derived arrears payment bill ahead", () => {
    // ARREARS is worked out from what the money did, never asked for — but if
    // it ever reaches this rule it settles the past, never the future.
    expect(mayBillAhead("ARREARS")).toBe(false);
  });

  it("refuses anything it does not recognise", () => {
    expect(mayBillAhead("")).toBe(false);
    expect(mayBillAhead("advance")).toBe(false);
  });
});
