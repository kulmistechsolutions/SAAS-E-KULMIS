import { UserRole, dashboardVisibilityFor, roleHasModule } from "@ekulmis/shared";

/**
 * What the first screen after login is allowed to show.
 *
 * KTS: an attendance officer holding attendance and reports — and nothing
 * else, as their own Roles & Permissions page said in ticks — opened the
 * dashboard to 127 students, 3 teachers, 55 parents and 20 classes. Masking
 * the money had already been done and was not enough, because the fault was
 * never about money: "signed in" was being read as "may see the totals".
 */

const {
  ADMINISTRATOR,
  ACADEMIC_MANAGER,
  FINANCE_OFFICER,
  ATTENDANCE_OFFICER,
  EXAM_MANAGER,
  RECEPTION_OFFICER,
  LIBRARIAN,
} = UserRole;

describe("what each role's dashboard may show", () => {
  describe("an attendance officer", () => {
    const v = dashboardVisibilityFor(ATTENDANCE_OFFICER);

    it("sees the register, which is the whole of the role", () => {
      expect(v.attendance).toBe(true);
    });

    it("is not shown the school's roll", () => {
      // The four counts from the report: students, teachers, parents, classes.
      expect(v.students).toBe(false);
      expect(v.teachers).toBe(false);
      expect(v.parents).toBe(false);
      expect(v.academics).toBe(false);
    });

    it("is not shown the money, nor the exams, nor who did what", () => {
      expect(v.fees).toBe(false);
      expect(v.finance).toBe(false);
      expect(v.exams).toBe(false);
      // The audit feed is the school watching its own staff — including this
      // officer. It is not a staff member's own screen.
      expect(v.activity).toBe(false);
    });
  });

  describe("a finance officer", () => {
    const v = dashboardVisibilityFor(FINANCE_OFFICER);

    it("sees the money it is answerable for", () => {
      expect(v.fees).toBe(true);
      expect(v.finance).toBe(true);
    });

    it("is not shown the register or the exam calendar", () => {
      expect(v.attendance).toBe(false);
      expect(v.exams).toBe(false);
    });
  });

  describe("the other staff roles", () => {
    it("gives an exam manager the exams and nothing financial", () => {
      const v = dashboardVisibilityFor(EXAM_MANAGER);
      expect(v.exams).toBe(true);
      expect(v.fees).toBe(false);
      expect(v.students).toBe(false);
    });

    it("gives reception the people it registers", () => {
      const v = dashboardVisibilityFor(RECEPTION_OFFICER);
      expect([v.students, v.parents, v.teachers]).toEqual([true, true, true]);
      expect(v.finance).toBe(false);
    });

    it("gives a librarian the student list its work needs, and no more", () => {
      const v = dashboardVisibilityFor(LIBRARIAN);
      expect(v.students).toBe(true);
      expect(v.attendance).toBe(false);
      expect(v.finance).toBe(false);
    });

    it("gives an academic manager the academic picture, not the money", () => {
      const v = dashboardVisibilityFor(ACADEMIC_MANAGER);
      expect(v.academics).toBe(true);
      expect(v.exams).toBe(true);
      expect(v.fees).toBe(false);
    });
  });

  describe("an administrator", () => {
    it("sees all of it", () => {
      const v = dashboardVisibilityFor(ADMINISTRATOR);
      expect(Object.values(v).every(Boolean)).toBe(true);
    });
  });

  describe("a role nobody has described", () => {
    it("is shown nothing at all", () => {
      // A role added later must start closed and be opened deliberately, not
      // inherit the whole school by being unlisted.
      const v = dashboardVisibilityFor("SOME_NEW_ROLE");
      expect(Object.values(v).some(Boolean)).toBe(false);
    });
  });

  describe("the module map the whole thing rests on", () => {
    it("agrees with the ticks a school sees on Roles & Permissions", () => {
      expect(roleHasModule(ATTENDANCE_OFFICER, "attendance")).toBe(true);
      expect(roleHasModule(ATTENDANCE_OFFICER, "reports")).toBe(true);
      expect(roleHasModule(ATTENDANCE_OFFICER, "students")).toBe(false);
      expect(roleHasModule(ATTENDANCE_OFFICER, "fees")).toBe(false);
    });

    it("never lets a non-administrator hold users, settings or audit", () => {
      for (const role of [
        ACADEMIC_MANAGER,
        FINANCE_OFFICER,
        ATTENDANCE_OFFICER,
        EXAM_MANAGER,
        RECEPTION_OFFICER,
        LIBRARIAN,
      ]) {
        for (const mod of ["users", "settings", "audit"] as const) {
          expect([role, mod, roleHasModule(role, mod)]).toEqual([
            role,
            mod,
            false,
          ]);
        }
      }
    });
  });
});
