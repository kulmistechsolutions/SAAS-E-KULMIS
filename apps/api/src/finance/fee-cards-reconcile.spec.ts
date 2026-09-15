import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The three figures on Fee Management have to be one arithmetic.
 *
 * They were three. "Total expected" was the month's billing, "Outstanding this
 * month" was that billing minus what had been applied to it — but "Total
 * collected" was the cash the safe took during the month, which may settle a
 * different month entirely. So $2,452 − $1,862 came to $590 beside a card
 * reading $563, and the collection rate was struck from the same mixed pair.
 *
 * Settled is now derived as expected − outstanding, which makes the row
 * reconcile by construction, and the rate is struck from it. The cash figure
 * is kept, underneath, where it cannot be read as the same thing.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");

const store = readFileSync(join(WEB, "lib", "fees", "store.ts"), "utf8");
const cards = readFileSync(
  join(WEB, "components", "fees", "summary-cards.tsx"),
  "utf8",
);

describe("the fee cards reconcile", () => {
  it("derives settled from the two figures either side of it", () => {
    // Both paths — the engine's answer and the browser fallback for a month
    // the user scrolled back to.
    expect(store).toContain(
      "pos.expectedThisMonth - pos.outstandingThisMonth",
    );
    expect(store).toContain(
      "settledThisMonth: Math.max(0, expectedMonthlyIncome - outstandingThisMonth)",
    );
  });

  it("shows settled, not cash taken, as the headline figure", () => {
    expect(cards).toContain("amount: (s) => money(s.settledThisMonth)");
    expect(cards).not.toContain("amount: (s) => money(s.collectedThisMonth)");
  });

  it("strikes the collection rate from settled over expected", () => {
    expect(cards).toContain(
      "(s.settledThisMonth / s.expectedMonthlyIncome) * 100",
    );
    expect(cards).not.toContain(
      "(s.collectedThisMonth / s.expectedMonthlyIncome) * 100",
    );
  });

  it("still shows the cash actually taken, beneath", () => {
    // Losing it would answer a question nobody asked and drop one a bursar
    // does: what came through the door this month.
    expect(cards).toContain("money(s.collectedThisMonth)");
    expect(cards).toContain("money(s.collectedToday)");
  });
});
