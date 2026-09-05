import { staffCanOpen, UserRole } from "@ekulmis/shared";
import { searchableTypesForRole } from "../search/search.service";

/**
 * What each role may reach.
 *
 * Written because the menu, the route guard and the server had each worked
 * this out separately and disagreed — in both directions. Roles were shown
 * pages the server refuses, and were hidden from pages it allows. Every case
 * below is one of those, named by the role it was wrong for, so the next
 * change to the permission table has to keep answering them.
 */

const {
  ACADEMIC_MANAGER: AM,
  FINANCE_OFFICER: FO,
  ATTENDANCE_OFFICER: AO,
  EXAM_MANAGER: EM,
  RECEPTION_OFFICER: RO,
  LIBRARIAN: LIB,
  TEACHER,
} = UserRole;

describe("which pages a staff role may open", () => {
  describe("an attendance officer", () => {
    it("opens the registers it was assigned", () => {
      expect(staffCanOpen(AO, "/attendance/my-classes")).toBe(true);
      expect(staffCanOpen(AO, "/attendance/students")).toBe(true);
      expect(staffCanOpen(AO, "/attendance/shifts")).toBe(true);
    });

    it("is not shown the screen that appoints officers", () => {
      // The endpoint behind it is administrator-only, so this page could only
      // ever fail — and it is the page where an officer would grant
      // themselves another class.
      expect(staffCanOpen(AO, "/attendance/officers")).toBe(false);
    });

    it("is not shown the screen that grades its own performance", () => {
      expect(staffCanOpen(AO, "/attendance/monitoring")).toBe(false);
    });

    it("never reaches the school's money", () => {
      for (const page of [
        "/finance",
        "/finance/collect",
        "/salary",
        "/expenses",
        "/other-income",
        "/reports/financial",
        "/reports/fees",
      ]) {
        expect([page, staffCanOpen(AO, page)]).toEqual([page, false]);
      }
    });

    it("reaches attendance reports and nothing else in the centre", () => {
      expect(staffCanOpen(AO, "/reports/attendance")).toBe(true);
      expect(staffCanOpen(AO, "/reports/salary")).toBe(false);
    });
  });

  describe("a finance officer", () => {
    it("opens every money page it is answerable for", () => {
      for (const page of [
        "/finance/collect",
        "/finance/debts",
        "/finance/extra-fees",
        "/salary/payroll",
        "/expenses/list",
        "/reports/financial",
      ]) {
        expect([page, staffCanOpen(FO, page)]).toEqual([page, true]);
      }
    });

    it("is shown Additional Income", () => {
      // It sits in the expenses menu and shares its endpoint, but had no rule
      // of its own — so the one role that may record it never saw the link.
      expect(staffCanOpen(FO, "/other-income")).toBe(true);
    });

    it("may buy SMS credit, which spends the school's money", () => {
      expect(staffCanOpen(FO, "/sms/packages")).toBe(true);
      expect(staffCanOpen(EM, "/sms/packages")).toBe(false);
      expect(staffCanOpen(AM, "/sms/packages")).toBe(false);
    });

    it("does not run exams, take registers or manage users", () => {
      expect(staffCanOpen(FO, "/examinations/create")).toBe(false);
      expect(staffCanOpen(FO, "/attendance/students")).toBe(false);
      expect(staffCanOpen(FO, "/users/list")).toBe(false);
      expect(staffCanOpen(FO, "/settings/security")).toBe(false);
    });
  });

  describe("an academic manager", () => {
    it("reads exam results without being offered the exam desk", () => {
      // The server allows this role the summary and nothing else. It was
      // being shown Create Exam, Enter Marks and Import Marks, all of which
      // returned 403 the moment it touched them.
      expect(staffCanOpen(AM, "/examinations/reports")).toBe(true);
      expect(staffCanOpen(AM, "/examinations/create")).toBe(false);
      expect(staffCanOpen(AM, "/examinations/marks")).toBe(false);
      expect(staffCanOpen(AM, "/examinations/marks-import")).toBe(false);
      // The class result sheets are served to the exam desk only.
      expect(staffCanOpen(AM, "/examinations/results")).toBe(false);
    });

    it("runs promotions and reads the academic structure", () => {
      expect(staffCanOpen(AM, "/promotions/promote")).toBe(true);
      expect(staffCanOpen(AM, "/academics/classes")).toBe(true);
      expect(staffCanOpen(AM, "/teachers/assignments")).toBe(true);
    });

    it("watches quizzes without being handed the exam manager's builder", () => {
      expect(staffCanOpen(AM, "/quiz/monitoring")).toBe(true);
      expect(staffCanOpen(AM, "/quiz/create")).toBe(false);
      // The quiz report sheets answer finance and the exam manager, not this role.
      expect(staffCanOpen(AM, "/quiz/reports")).toBe(false);
    });
  });

  describe("an exam manager", () => {
    it("gets the quiz pages the server has always allowed it", () => {
      expect(staffCanOpen(EM, "/quiz/create")).toBe(true);
      expect(staffCanOpen(EM, "/quiz/list")).toBe(true);
    });

    it("prints exam cards but does not hold the student register", () => {
      expect(staffCanOpen(EM, "/id-cards")).toBe(true);
      expect(staffCanOpen(EM, "/students")).toBe(false);
    });
  });

  describe("a reception officer and a librarian", () => {
    it("both reach the student list they work from", () => {
      expect(staffCanOpen(RO, "/students")).toBe(true);
      expect(staffCanOpen(LIB, "/students")).toBe(true);
    });

    it("keeps the librarian out of ID card printing", () => {
      // Card printing rode along with a student-list grant; the endpoint
      // behind it has never answered a librarian.
      expect(staffCanOpen(LIB, "/id-cards")).toBe(false);
      expect(staffCanOpen(RO, "/id-cards")).toBe(true);
    });

    it("keeps reception out of the money and the library out of everything else", () => {
      expect(staffCanOpen(RO, "/finance/collect")).toBe(false);
      expect(staffCanOpen(LIB, "/library")).toBe(true);
      expect(staffCanOpen(LIB, "/examinations")).toBe(false);
    });
  });

  describe("pages nobody but an administrator holds", () => {
    it("refuses every staff role", () => {
      for (const role of [AM, FO, AO, EM, RO, LIB]) {
        for (const page of ["/users", "/settings", "/timetable"]) {
          expect([role, page, staffCanOpen(role, page)]).toEqual([
            role,
            page,
            false,
          ]);
        }
      }
    });
  });

  it("refuses a page nobody has placed in the table", () => {
    // A new page is not public by accident: until somebody decides who it is
    // for, the answer is the administrator.
    expect(staffCanOpen(FO, "/some-new-module")).toBe(false);
  });
});

describe("what the search box may find", () => {
  it("keeps an attendance officer to children, never staff or parents", () => {
    // The box searched all three for every role, which was a way around the
    // fence on the student list itself — including parents by phone number.
    expect(searchableTypesForRole(AO)).toEqual(["student"]);
  });

  it("keeps a teacher and a librarian to children too", () => {
    expect(searchableTypesForRole(TEACHER)).toEqual(["student"]);
    expect(searchableTypesForRole(LIB)).toEqual(["student"]);
  });

  it("lets finance find the parent paying and the employee being paid", () => {
    expect(searchableTypesForRole(FO)).toEqual(["student", "teacher", "parent"]);
  });

  it("does not hand an exam manager the parent directory", () => {
    expect(searchableTypesForRole(EM)).not.toContain("parent");
  });

  it("finds nothing at all for a role outside the staff list", () => {
    expect(searchableTypesForRole(UserRole.PARENT)).toEqual([]);
    expect(searchableTypesForRole(UserRole.STUDENT)).toEqual([]);
  });
});
