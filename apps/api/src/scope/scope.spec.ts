import { ScopeService } from "./scope.service";
import type { PrismaService } from "../prisma/prisma.service";

/**
 * Which classes a person may act within.
 *
 * A permission says what someone may do; this says to whom. The two are
 * separate answers and the system needs both: an officer granted
 * `attendance.create` was never thereby allowed to mark the whole school.
 *
 * The case worth pinning hardest is the difference between "no restriction"
 * and "restricted to nothing". They are one keystroke apart in code and
 * opposite in effect — collapsing them is how an officer nobody has given a
 * class to would come to see every child in the school.
 */

/** A tenant client that answers only the one query this service makes. */
function prismaWith(
  rows: { classId: string; sectionId: string | null }[],
): PrismaService {
  return {
    forTenant: (_schoolId: string, fn: (tx: unknown) => unknown) =>
      Promise.resolve(
        fn({ attendanceAssignment: { findMany: () => Promise.resolve(rows) } }),
      ),
  } as unknown as PrismaService;
}

const scopeWith = (classIds: string[]) =>
  new ScopeService(
    prismaWith(classIds.map((classId) => ({ classId, sectionId: null }))),
  );
const scopeOf = (rows: { classId: string; sectionId: string | null }[]) =>
  new ScopeService(prismaWith(rows));

describe("who a person may act on", () => {
  describe("a role scoped by its nature", () => {
    it("reaches the classes it was assigned", async () => {
      const s = scopeWith(["c6", "c7"]);
      await expect(s.visibleClassIds("sch", "u1", "ATTENDANCE_OFFICER")).resolves.toEqual(
        ["c6", "c7"],
      );
    });

    it("reaches nothing at all when nobody has assigned it a class", async () => {
      // Not "everything". An officer with no grants has no register to take,
      // and the empty list is what makes every list query return nothing.
      const s = scopeWith([]);
      await expect(s.visibleClassIds("sch", "u1", "ATTENDANCE_OFFICER")).resolves.toEqual(
        [],
      );
      await expect(s.visibleClassIds("sch", "u1", "TEACHER")).resolves.toEqual([]);
    });
  });

  describe("a role that is not scoped by its nature", () => {
    it("reaches the whole school when it has no assignments", async () => {
      // Null, not []. This is every role today, and an administrator must
      // keep seeing its own school.
      const s = scopeWith([]);
      await expect(s.visibleClassIds("sch", "u1", "FINANCE_OFFICER")).resolves.toBeNull();
      await expect(s.visibleClassIds("sch", "u1", "LIBRARIAN")).resolves.toBeNull();
    });

    it("becomes scoped the moment a school assigns it classes", async () => {
      // How a school says "this clerk handles Grade 8 only" — and it now
      // means the collection list, not only the register.
      const s = scopeWith(["c8"]);
      await expect(s.visibleClassIds("sch", "u1", "FINANCE_OFFICER")).resolves.toEqual([
        "c8",
      ]);
    });
  });

  it("never scopes an administrator, whatever rows exist", async () => {
    // The people handing out the grants are not held by them; a school that
    // cannot see its own registers cannot supervise the people taking them.
    const s = scopeWith(["c1"]);
    await expect(s.visibleClassIds("sch", "u1", "ADMINISTRATOR")).resolves.toBeNull();
    await expect(
      s.visibleClassIds("sch", "u1", "SUPER_ADMINISTRATOR"),
    ).resolves.toBeNull();
  });

  describe("turning a scope into a query", () => {
    const s = scopeWith([]);

    it("adds no condition when there is no restriction", () => {
      expect(s.studentWhere(null)).toEqual({});
    });

    it("matches nothing when the scope is nothing", () => {
      // `{}` here would return the whole school — the exact inversion this
      // separation exists to prevent.
      expect(s.studentWhere([])).toEqual({ classId: { in: [] } });
    });

    it("matches the assigned classes otherwise", () => {
      expect(s.studentWhere(["c6", "c7"])).toEqual({
        classId: { in: ["c6", "c7"] },
      });
    });
  });

  describe("asking about one class", () => {
    const s = scopeWith([]);

    it("admits every class when unrestricted", () => {
      expect(s.covers(null, "c9")).toBe(true);
      expect(s.covers(null, null)).toBe(true);
    });

    it("admits only the assigned ones", () => {
      expect(s.covers(["c6"], "c6")).toBe(true);
      expect(s.covers(["c6"], "c9")).toBe(false);
    });

    it("admits nothing when the scope is empty", () => {
      expect(s.covers([], "c6")).toBe(false);
    });

    it("refuses a student who is in no class at all", () => {
      expect(s.covers(["c6"], null)).toBe(false);
    });
  });
});

describe("narrowing a scope to a section", () => {
  /**
   * A school hands out "Grade 8" or "Grade 8, Section A", and the difference
   * has to survive into every query. The database has stored the section
   * since the officer feature was built; nothing outside attendance had ever
   * read it.
   */
  it("keeps the section on a grant that has one", async () => {
    const s = scopeOf([{ classId: "c8", sectionId: "sA" }]);
    await expect(s.visibleScope("sch", "u1", "FINANCE_OFFICER")).resolves.toEqual([
      { classId: "c8", sectionId: "sA" },
    ]);
  });

  it("lets a whole-class grant swallow a narrower one on the same class", async () => {
    // Otherwise "Grade 8" plus "Grade 8 Section A" would read as Section A
    // only — the opposite of what was handed out.
    const s = scopeOf([
      { classId: "c8", sectionId: null },
      { classId: "c8", sectionId: "sA" },
    ]);
    await expect(s.visibleScope("sch", "u1", "FINANCE_OFFICER")).resolves.toEqual([
      { classId: "c8", sectionId: null },
    ]);
  });

  it("still reports the class when only classes are asked for", async () => {
    const s = scopeOf([
      { classId: "c8", sectionId: "sA" },
      { classId: "c8", sectionId: "sB" },
    ]);
    await expect(s.visibleClassIds("sch", "u1", "FINANCE_OFFICER")).resolves.toEqual([
      "c8",
    ]);
  });

  describe("turning a sectioned scope into a query", () => {
    const s = scopeWith([]);

    it("matches the whole class when no section was named", () => {
      expect(s.studentWhere([{ classId: "c8", sectionId: null }])).toEqual({
        OR: [{ classId: "c8" }],
      });
    });

    it("matches only that section when one was", () => {
      expect(s.studentWhere([{ classId: "c8", sectionId: "sA" }])).toEqual({
        OR: [{ classId: "c8", sectionId: "sA" }],
      });
    });

    it("still matches nothing when the scope is nothing", () => {
      expect(s.studentWhere([])).toEqual({ classId: { in: [] } });
    });
  });

  describe("asking about one student", () => {
    const s = scopeWith([]);
    const grants = [{ classId: "c8", sectionId: "sA" }];

    it("admits a child in the named section", () => {
      expect(s.covers(grants, "c8", "sA")).toBe(true);
    });

    it("refuses the same class in another section", () => {
      expect(s.covers(grants, "c8", "sB")).toBe(false);
    });

    it("refuses a child with no section when a section was named", () => {
      expect(s.covers(grants, "c8", null)).toBe(false);
    });

    it("admits every section when the grant named none", () => {
      const whole = [{ classId: "c8", sectionId: null }];
      expect(s.covers(whole, "c8", "sA")).toBe(true);
      expect(s.covers(whole, "c8", null)).toBe(true);
    });
  });
});
