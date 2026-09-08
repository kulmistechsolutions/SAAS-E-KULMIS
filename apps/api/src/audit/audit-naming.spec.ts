import { extractMetadata, friendlyAction } from "./audit.interceptor";

/**
 * What the log calls things, and what it remembers about them.
 *
 * A school opens the audit log months later with a specific question — who
 * reversed that receipt, who set August's billing running — and answers it by
 * reading. So the name has to be readable by the desk rather than derived from
 * the URL, and the entry has to carry the facts of the thing: how much, for
 * whom, which month. An entry saying only that something happened is not
 * evidence of anything.
 *
 * These are pure functions of a request. The alternative way to check them is
 * to take a real payment on a live school, which is not a test.
 */
describe("naming what happened", () => {
  it("names taking money as taking money", () => {
    // Was PAY_CREATED, from the last path segment.
    expect(friendlyAction("POST", "/api/fees/pay")).toBe("FEE_COLLECTED");
    expect(friendlyAction("POST", "/api/fees/pay-family")).toBe(
      "FAMILY_FEE_COLLECTED",
    );
  });

  it("names the two setups that create a school's obligations", () => {
    // The most consequential action in the module: it bills everyone.
    expect(friendlyAction("POST", "/api/fees/setup-month")).toBe(
      "MONTH_BILLING_SET_UP",
    );
    expect(friendlyAction("POST", "/api/fees/setup-academic-year")).toBe(
      "YEAR_BILLING_SET_UP",
    );
  });

  it("names undoing money separately from taking it", () => {
    expect(
      friendlyAction("POST", "/api/fees/payments/cmt123456789012345678/reverse"),
    ).toBe("PAYMENT_REVERSED");
    expect(
      friendlyAction("POST", "/api/fees/payments/cmt123456789012345678/print"),
    ).toBe("RECEIPT_PRINTED");
  });

  it("names a change to what a family owes", () => {
    expect(friendlyAction("POST", "/api/fees/fee-change")).toBe(
      "MONTHLY_FEE_CHANGED",
    );
    expect(friendlyAction("POST", "/api/fees/adjustments")).toBe("FEE_ADJUSTED");
    expect(
      friendlyAction("POST", "/api/fees/extra/cmt123456789012345678/apply"),
    ).toBe("EXTRA_FEE_APPLIED");
  });

  it("names money leaving as well as arriving", () => {
    expect(friendlyAction("POST", "/api/expenses")).toBe("EXPENSE_RECORDED");
    expect(friendlyAction("POST", "/api/other-income")).toBe("INCOME_RECORDED");
  });

  it("still falls back to something readable for anything unlisted", () => {
    // Never the raw "METHOD /path": an unnamed action is still an action.
    expect(friendlyAction("PATCH", "/api/settings")).toBe("SETTINGS_UPDATED");
    expect(friendlyAction("DELETE", "/api/villages/cmt123456789012345678")).toBe(
      "VILLAGES_DELETED",
    );
  });
});

describe("remembering the facts of a financial entry", () => {
  it("keeps how much, for whom, and why", () => {
    expect(
      extractMetadata({
        studentId: "st1",
        amount: 40,
        year: 2026,
        month: 9,
        reason: "duplicate payment",
      }),
    ).toEqual({
      studentId: "st1",
      amount: 40,
      year: 2026,
      month: 9,
      reason: "duplicate payment",
    });
  });

  it("keeps an amount as a number so it can be summed, not just shown", () => {
    const meta = extractMetadata({ amount: 12.5 });
    expect(meta.amount).toBe(12.5);
    expect(typeof meta.amount).toBe("number");
  });

  it("drops what it was not asked to keep", () => {
    // A password or a token reaching an audit row would be the log becoming
    // the leak, so this is an allow-list and stays one.
    expect(extractMetadata({ password: "hunter2", token: "abc" })).toEqual({});
  });

  it("survives a request with no body at all", () => {
    expect(extractMetadata(undefined)).toEqual({});
  });
});
