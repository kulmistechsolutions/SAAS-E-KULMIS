import { BalanceEngineService, type ChargeLine } from "./balance-engine.service";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * The money rules, pinned.
 *
 * Every bug in this file's history has been the same shape: a rule that lived
 * in one place got re-derived somewhere else, slightly differently, and no
 * screen agreed with any other. They were each found by a school noticing its
 * own money looked wrong — never by us. These are the exact cases schools
 * reported, written down so the next change has to keep answering them.
 *
 * Deliberately reaches the two private rule functions rather than going
 * through Prisma: these are pure, and the whole point is to hold the rules
 * still without needing a database to do it.
 */

const engine = new BalanceEngineService(null as unknown as PrismaService);

type Rules = {
  toLines(
    rows: {
      id: string;
      kind: string;
      label: string | null;
      year: number;
      month: number;
      amount: number;
      paidAmount: number;
      status: string;
    }[],
    liveYm: number,
    free: boolean,
  ): ChargeLine[];
  summarise(
    lines: ChargeLine[],
    free: boolean,
  ): {
    expected: number;
    paid: number;
    outstanding: number;
    advance: number;
    credit: number;
    state: string;
  };
};

const rules = engine as unknown as Rules;

/** One monthly charge. Defaults to a plain $10 month nobody has paid. */
const charge = (
  over: Partial<{
    id: string;
    kind: string;
    label: string | null;
    year: number;
    month: number;
    amount: number;
    paidAmount: number;
    status: string;
  }> = {},
) => ({
  id: "c1",
  kind: "MONTHLY",
  label: null,
  year: 2026,
  month: 9,
  amount: 10,
  paidAmount: 0,
  status: "UNPAID",
  ...over,
});

const LIVE = 202609;

/** The state one student's charges roll up to. */
const stateOf = (
  rows: ReturnType<typeof charge>[],
  free = false,
  liveYm = LIVE,
) => rules.summarise(rules.toLines(rows, liveYm, free), free);

describe("what a student's fees roll up to", () => {
  describe("Partial means somebody part-paid a month", () => {
    // IQRA, 2026-09: 173 students read "Partial" while owing the whole month.
    // The rollup asked "has this family paid anything across every month due",
    // which a family who settled August in full answers yes to — so September,
    // untouched, was reported as partly paid and the desk went looking for a
    // payment that was never made.
    it("calls a fully-owed month unpaid even when an earlier month was settled", () => {
      const s = stateOf([
        charge({ id: "aug", month: 8, amount: 14, paidAmount: 14, status: "PAID" }),
        charge({ id: "sep", month: 9, amount: 14, paidAmount: 0 }),
      ]);
      expect(s.state).toBe("UNPAID");
      expect(s.outstanding).toBe(14);
    });

    it("calls it partial only when a month is itself part-paid", () => {
      const s = stateOf([
        charge({ id: "sep", month: 9, amount: 14, paidAmount: 6, status: "PARTIAL" }),
      ]);
      expect(s.state).toBe("PARTIAL");
      expect(s.outstanding).toBe(8);
    });

    it("is unpaid when nothing at all has been paid", () => {
      expect(stateOf([charge()]).state).toBe("UNPAID");
    });

    it("is paid when every due month is settled", () => {
      const s = stateOf([
        charge({ id: "aug", month: 8, paidAmount: 10, status: "PAID" }),
        charge({ id: "sep", month: 9, paidAmount: 10, status: "PAID" }),
      ]);
      expect(s.state).toBe("PAID");
      expect(s.outstanding).toBe(0);
    });
  });

  describe("Free is its own answer, not a kind of paid", () => {
    // Filtering Collect Fees to "Paid" used to return every free student
    // alongside the families who had just handed money over, and there was no
    // way to ask for the free ones at all.
    it("reports a waived student as free, never as paid", () => {
      const s = stateOf([charge({ amount: 0, paidAmount: 0, status: "PAID" })], true);
      expect(s.state).toBe("FREE");
    });

    it("marks a zero month on a free student free rather than unpaid", () => {
      const [line] = rules.toLines([charge({ amount: 0 })], LIVE, true);
      expect(line!.status).toBe("FREE");
    });
  });

  describe("Due, and what is not yet owed", () => {
    // A month later than the live one is money a family may pay ahead but does
    // not owe. Counting it as expected is what made schools look short.
    it("leaves a future month out of what is owed", () => {
      const s = stateOf([charge({ month: 10, amount: 10, paidAmount: 0 })]);
      expect(s.expected).toBe(0);
      expect(s.outstanding).toBe(0);
      expect(s.state).toBe("UNBILLED");
    });

    it("counts a future month already paid as an advance, not as income owed", () => {
      // NUURUL-YAQIIN: three families paid October during September and were
      // reported as owing nothing, which was right — and as Advance (1),
      // which was also right.
      const s = stateOf([
        charge({ id: "sep", month: 9, paidAmount: 10, status: "PAID" }),
        charge({ id: "oct", month: 10, paidAmount: 10, status: "PAID" }),
      ]);
      expect(s.state).toBe("ADVANCE");
      expect(s.advance).toBe(10);
      expect(s.outstanding).toBe(0);
    });

    it("treats the live month itself as due", () => {
      const [line] = rules.toLines([charge({ month: 9 })], LIVE, false);
      expect(line!.due).toBe(true);
    });
  });

  describe("Money that has to land somewhere", () => {
    it("keeps payment beyond a charge as credit rather than dropping it", () => {
      // Happens when a fee is lowered after the family has already paid.
      const s = stateOf([
        charge({ amount: 10, paidAmount: 12, status: "PAID" }),
      ]);
      expect(s.credit).toBe(2);
    });

    it("never reports negative outstanding", () => {
      const s = stateOf([charge({ amount: 10, paidAmount: 25, status: "PAID" })]);
      expect(s.outstanding).toBe(0);
    });

    it("ignores a voided charge entirely", () => {
      // BARWAAQO had 149 pre-start charges voided in one afternoon; they must
      // not come back as debt through any total.
      const s = stateOf([
        charge({ id: "void", status: "INACTIVE", amount: 500 }),
        charge({ id: "sep", month: 9, amount: 10, paidAmount: 10, status: "PAID" }),
      ]);
      expect(s.expected).toBe(10);
      expect(s.outstanding).toBe(0);
      expect(s.state).toBe("PAID");
    });
  });

  describe("A student nobody has billed", () => {
    it("is unbilled rather than paid up", () => {
      // Reporting "PAID" for a student with no charges is how newly
      // registered children disappeared from what a school expected to collect.
      expect(stateOf([]).state).toBe("UNBILLED");
    });
  });
});
