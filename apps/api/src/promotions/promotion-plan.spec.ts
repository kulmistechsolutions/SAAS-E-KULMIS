import {
  explainEmptyPromotion,
  nextAcademicYear,
  planPromotions,
} from "@ekulmis/shared";

/**
 * Where each student goes when a class is promoted.
 *
 * Haldoor, 2025-2026: 172 students, every row reading "Eligible / Ready",
 * and the screen answered "No eligible students to promote". The run asked
 * for one destination class to send all 172 to, the school-wide flow supplies
 * none, and so every child was skipped — while the summary card promised
 * "Auto (one grade up)". These cases pin both halves: the destination each
 * student actually gets, and the school being told the real reason when
 * nobody moves.
 */

const LADDER = [
  "Grade 1",
  "Grade 2",
  "Grade 3",
  "Grade 4",
  "Grade 5",
  "Grade 6",
  "Grade 7",
  "Grade 8",
];

const student = (id: string, className: string, eligible = true) => ({
  id,
  className,
  eligible,
});

const plan = (
  students: { id: string; className: string; eligible: boolean }[],
  toClassName?: string | null,
) => planPromotions({ students, orderedClasses: LADDER, toClassName });

describe("planning a promotion", () => {
  describe('"Auto (one grade up)" — no destination chosen', () => {
    it("sends each student one step up their own ladder", () => {
      // The whole bug in one case: a mixed-class run has no single
      // destination, and every student still has one.
      const p = plan([
        student("a", "Grade 1"),
        student("b", "Grade 4"),
        student("c", "Grade 7"),
      ]);
      expect(p.actions).toEqual([
        { studentId: "a", action: "PROMOTE", toClassName: "Grade 2" },
        { studentId: "b", action: "PROMOTE", toClassName: "Grade 5" },
        { studentId: "c", action: "PROMOTE", toClassName: "Grade 8" },
      ]);
      expect(p.skipped).toBe(0);
    });

    it("promotes a whole school rather than skipping all of it", () => {
      // Haldoor's shape: seven year groups, none of them final.
      const roll = [
        ...Array.from({ length: 21 }, (_, i) => student(`g1-${i}`, "Grade 1")),
        ...Array.from({ length: 32 }, (_, i) => student(`g2-${i}`, "Grade 2")),
        ...Array.from({ length: 14 }, (_, i) => student(`g7-${i}`, "Grade 7")),
      ];
      const p = plan(roll);
      expect(p.promoting).toBe(67);
      expect(p.skipped).toBe(0);
    });

    it("graduates the top of the ladder instead of inventing a class above it", () => {
      const p = plan([student("a", "Grade 8")]);
      expect(p.actions).toEqual([{ studentId: "a", action: "GRADUATE" }]);
      expect(p.graduating).toBe(1);
    });
  });

  describe("a destination chosen by hand", () => {
    it("sends everyone there", () => {
      const p = plan([student("a", "Grade 4"), student("b", "Grade 5")], "Grade 6");
      expect(p.actions.every((a) => a.action === "PROMOTE")).toBe(true);
      expect(p.promoting).toBe(2);
    });

    it("still graduates a student in the final class", () => {
      // Finishing school is not a class you can be moved to.
      const p = plan([student("a", "Grade 8")], "Grade 3");
      expect(p.actions).toEqual([{ studentId: "a", action: "GRADUATE" }]);
    });

    it("leaves a student already in that class where they are", () => {
      const p = plan([student("a", "Grade 6")], "Grade 6");
      expect(p.skippedBy.ALREADY_THERE).toBe(1);
      expect(p.promoting).toBe(0);
    });
  });

  describe("students the rules stop", () => {
    it("skips the ineligible and promotes the rest in the same run", () => {
      const p = plan([
        student("a", "Grade 2"),
        student("b", "Grade 2", false),
        student("c", "Grade 3"),
      ]);
      expect(p.promoting).toBe(2);
      expect(p.skippedBy.NOT_ELIGIBLE).toBe(1);
    });

    it("skips a class that is not in this year's ladder at all", () => {
      // A class from another year, or one renamed since — there is no "next"
      // to work out, and guessing one would move a child at random.
      const p = plan([student("a", "Nursery")]);
      expect(p.skippedBy.CLASS_NOT_IN_LADDER).toBe(1);
    });
  });

  describe("what the school is told when nobody moves", () => {
    it("names the missing next class rather than blaming eligibility", () => {
      // The old message said "No eligible students to promote" over a table
      // in which all 172 read Eligible.
      const p = plan([student("a", "Nursery"), student("b", "Reception")]);
      const message = explainEmptyPromotion(p);
      expect(message).toContain("2 have no next class");
      expect(message).not.toContain("eligibility rules");
    });

    it("says so plainly when it really was the eligibility rules", () => {
      const p = plan([student("a", "Grade 2", false)]);
      expect(explainEmptyPromotion(p)).toContain("did not meet the eligibility rules");
    });

    it("counts each reason separately when several applied", () => {
      const p = plan(
        [student("a", "Grade 6"), student("b", "Grade 6", false)],
        "Grade 6",
      );
      const message = explainEmptyPromotion(p);
      expect(message).toContain("1 are already in the class you chose");
      expect(message).toContain("1 did not meet");
    });
  });
});

describe("which academic year a promotion lands in", () => {
  // Haldoor, 2026-09-05: 21 children were promoted one grade up and left in
  // 2025-2026. The new year's classes stayed empty, the old year's Grade 1
  // still listed students, and the school could not tell whether the
  // promotion had run.
  const YEARS = ["2024-2025", "2025-2026", "2026-2027"];

  it("moves a school into the following year, not up a grade inside its own", () => {
    expect(nextAcademicYear("2025-2026", YEARS)).toBe("2026-2027");
  });

  it("does not skip a year when the list arrives out of order", () => {
    expect(nextAcademicYear("2024-2025", ["2026-2027", "2024-2025", "2025-2026"])).toBe(
      "2025-2026",
    );
  });

  it("refuses rather than inventing a year the school has not created", () => {
    // Naming "2027-2028" when nobody has created it only moves the failure
    // one step later, to a class lookup that cannot succeed.
    expect(nextAcademicYear("2026-2027", YEARS)).toBeNull();
  });

  it("has no answer for a year that is not the school's", () => {
    expect(nextAcademicYear("2019-2020", YEARS)).toBeNull();
  });

  it("handles a school that has only ever had one year", () => {
    expect(nextAcademicYear("2025-2026", ["2025-2026"])).toBeNull();
  });

  it("ignores a duplicated year in the list", () => {
    expect(
      nextAcademicYear("2025-2026", ["2025-2026", "2025-2026", "2026-2027"]),
    ).toBe("2026-2027");
  });

  it("puts the class ladder and the year together the way a promotion does", () => {
    // Grade 1 of 2025-2026 becomes Grade 2 of 2026-2027: the plan supplies
    // the class, this supplies the year, and neither alone is the answer.
    const p = plan([student("a", "Grade 1")]);
    expect(p.actions[0]).toEqual({
      studentId: "a",
      action: "PROMOTE",
      toClassName: "Grade 2",
    });
    expect(nextAcademicYear("2025-2026", YEARS)).toBe("2026-2027");
  });
});
