import { liveMonthForClass } from "./students.service";

/**
 * Which month a class is actually being billed for.
 *
 * This is the boundary every fee recalculation is measured against, and taking
 * it from the school rather than the class cost Haldoor a term's fee. The
 * school had set October up for its nine senior classes; Grade 6 was still
 * collecting September. Every calculation keyed off "the latest month this
 * school set up" therefore treated October as the line, so when a Grade 6
 * student was moved off free and given a $7 fee, the September charge she was
 * actually carrying sat below the line and was skipped — leaving the desk
 * looking at "$7.00 monthly fee, $0.00 outstanding, Unpaid".
 */

/** An activation table that answers only for the classes it was given. */
function txWith(rows: { classId: string; year: number; month: number }[]) {
  return {
    monthlyFeeActivation: {
      findFirst: ({ where }: { where?: { classId?: string } } = {}) => {
        const mine = rows
          .filter((r) => !where?.classId || r.classId === where.classId)
          .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
        const row = mine[0];
        // The real call selects only these two, and the caller returns the row
        // as-is — so the double has to narrow it the same way or the test is
        // asserting against a shape production never sees.
        return Promise.resolve(row ? { year: row.year, month: row.month } : null);
      },
    },
  } as unknown as Parameters<typeof liveMonthForClass>[0];
}

describe("the month a class is being billed for", () => {
  const haldoor = [
    { classId: "grade6", year: 2026, month: 9 },
    // The senior classes, already set up a month ahead.
    { classId: "grade11", year: 2026, month: 9 },
    { classId: "grade11", year: 2026, month: 10 },
  ];

  it("answers for the class asked about, not the school", async () => {
    // The exact case: Grade 6 is on September while Grade 11 is on October.
    await expect(liveMonthForClass(txWith(haldoor), "grade6")).resolves.toEqual({
      year: 2026,
      month: 9,
    });
    await expect(liveMonthForClass(txWith(haldoor), "grade11")).resolves.toEqual({
      year: 2026,
      month: 10,
    });
  });

  it("takes the newest month that class has, not its first", async () => {
    await expect(
      liveMonthForClass(txWith(haldoor), "grade11"),
    ).resolves.toEqual({ year: 2026, month: 10 });
  });

  it("falls back to the calendar for a class nobody has billed", async () => {
    // A class with no activation has no live month of its own, and the
    // calendar is the only other answer available.
    const now = new Date();
    await expect(liveMonthForClass(txWith(haldoor), "grade1")).resolves.toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });

  it("falls back to the calendar for a student in no class at all", async () => {
    const now = new Date();
    await expect(liveMonthForClass(txWith(haldoor), null)).resolves.toEqual({
      year: now.getUTCFullYear(),
      month: now.getUTCMonth() + 1,
    });
  });
});
