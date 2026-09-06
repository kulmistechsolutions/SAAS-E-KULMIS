import { classifyPayment } from "@ekulmis/shared";

/**
 * What a receipt says a payment was.
 *
 * IQRA, 2026-09: the History screen showed "Partial Payment" against money
 * that had left nothing unpaid — 250 of the platform's 266 partial-labelled
 * payments were like that. The type recorded was whichever button the clerk
 * pressed, not what the money settled, and schools read that column to find
 * the families who still owe.
 *
 * Every case below is a real shape from IQRA's ledger, with the live month
 * September 2026.
 */

const LIVE = { liveYear: 2026, liveMonth: 9 } as const;

const classify = (
  lines: { year: number; month: number; settled: boolean }[],
  fallback: "THIS_MONTH" | "PARTIAL" | "ADVANCE" = "PARTIAL",
) => classifyPayment({ lines, ...LIVE, fallback });

const sep = (settled = true) => ({ year: 2026, month: 9, settled });
const aug = (settled = true) => ({ year: 2026, month: 8, settled });
const oct = (settled = true) => ({ year: 2026, month: 10, settled });

describe("what a payment gets recorded as", () => {
  describe("money that leaves nothing owing is not Partial", () => {
    it("calls a cleared earlier month Arrears", () => {
      // RCP00096: $17 settled August in full and was written down as
      // "Partial Payment", over a family that owed nothing for August at all.
      expect(classify([aug()])).toBe("ARREARS");
    });

    it("calls a cleared August-and-September up to date, not partial", () => {
      // RCP00086: $20 settled both months in full, labelled Partial.
      expect(classify([aug(), sep()])).toBe("THIS_MONTH");
    });

    it("calls a settled one-off charge Arrears rather than Partial", () => {
      // A registration or exam fee paid in full, months after it was raised.
      expect(classify([{ year: 2026, month: 7, settled: true }])).toBe("ARREARS");
    });
  });

  describe("Partial means something is still short", () => {
    it("is partial when the month it touched is not covered", () => {
      // RCP00030: $12 against August's $17.
      expect(classify([aug(false)])).toBe("PARTIAL");
    });

    it("is partial when one of several months is still short", () => {
      // RCP00083: August cleared, September left owing $13.
      expect(classify([aug(true), sep(false)])).toBe("PARTIAL");
    });

    it("prefers partial over advance when anything is left owing", () => {
      // Something still unpaid is the fact the desk needs; paying ahead while
      // owing is not a state the guard allows anyway.
      expect(classify([sep(false), oct(true)])).toBe("PARTIAL");
    });
  });

  describe("Advance is money for a month not yet due", () => {
    it("is advance when it reaches a later month", () => {
      // RCP00099: October, taken while September was already settled.
      expect(classify([oct()])).toBe("ADVANCE");
    });

    it("is advance even when it cleared this month on the way", () => {
      expect(classify([sep(), oct()])).toBe("ADVANCE");
    });

    it("is not advance for the live month itself", () => {
      // RCP00098: September, the month being collected.
      expect(classify([sep()])).toBe("THIS_MONTH");
    });
  });

  describe("a year boundary", () => {
    it("treats December as ahead of a November live month", () => {
      expect(
        classifyPayment({
          lines: [{ year: 2026, month: 12, settled: true }],
          liveYear: 2026,
          liveMonth: 11,
          fallback: "PARTIAL",
        }),
      ).toBe("ADVANCE");
    });

    it("treats last December as arrears against a January live month", () => {
      expect(
        classifyPayment({
          lines: [{ year: 2025, month: 12, settled: true }],
          liveYear: 2026,
          liveMonth: 1,
          fallback: "PARTIAL",
        }),
      ).toBe("ARREARS");
    });
  });

  it("falls back to what was asked when the money settled nothing nameable", () => {
    // Should not happen now that leftover money is always applied somewhere,
    // but a receipt with no type at all would be worse than an imperfect one.
    expect(classify([], "THIS_MONTH")).toBe("THIS_MONTH");
  });
});
