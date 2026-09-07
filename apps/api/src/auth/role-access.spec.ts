import {
  PERMISSIONS_BY_ROLE,
  canOpenWithPermissions,
  dashboardVisibilityFor,
  modulesForRole,
  staffCanOpen,
  UserRole,
} from "@ekulmis/shared";
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

describe("what the Roles & Permissions screen shows", () => {
  // KTS: a finance officer's matrix showed Students ticked across all eight
  // actions — a module the role has never held on any screen or any server.
  // The screen was reading its own copy out of the browser's storage, so
  // whatever it held the first time that machine opened the app is what it
  // kept showing, differently on every machine at the same school.

  it("gives a finance officer the money and nothing else", () => {
    const p = PERMISSIONS_BY_ROLE[FO]!;
    expect(Object.keys(p).sort()).toEqual(
      ["expenses", "fees", "finance", "reports", "salaries", "sms"],
    );
    expect(p.students).toBeUndefined();
    expect(p.attendance).toBeUndefined();
    expect(p.examinations).toBeUndefined();
  });

  it("gives an attendance officer the register and the reports", () => {
    expect(Object.keys(PERMISSIONS_BY_ROLE[AO]!).sort()).toEqual([
      "attendance",
      "reports",
    ]);
  });

  it("never lists a module with no actions behind it", () => {
    // An empty action list is a module a role does not hold, and a row of
    // eight unticked boxes reads as "granted, but nothing allowed".
    for (const [role, table] of Object.entries(PERMISSIONS_BY_ROLE)) {
      for (const [module, actions] of Object.entries(table)) {
        expect([role, module, actions?.length ?? 0]).not.toEqual([
          role,
          module,
          0,
        ]);
      }
    }
  });

  it("agrees with the module list every other screen reads", () => {
    // The two used to be written out by hand, separately. Now one is derived
    // from the other, and this is what says so.
    for (const role of Object.keys(PERMISSIONS_BY_ROLE)) {
      expect([role, modulesForRole(role).sort()]).toEqual([
        role,
        Object.keys(PERMISSIONS_BY_ROLE[role]!).sort(),
      ]);
    }
  });

  it("shows the dashboard exactly the sections the table grants", () => {
    // The count cards and the permission matrix are the same claim made
    // twice; this is the case that had 127 students on an officer's screen.
    expect(dashboardVisibilityFor(AO)).toEqual({
      students: false,
      teachers: false,
      parents: false,
      academics: false,
      attendance: true,
      fees: false,
      finance: false,
      exams: false,
      activity: false,
    });
    expect(dashboardVisibilityFor(FO).fees).toBe(true);
    expect(dashboardVisibilityFor(FO).students).toBe(false);
    expect(dashboardVisibilityFor(UserRole.ADMINISTRATOR).activity).toBe(true);
  });
});

describe("what a page needs, as a permission", () => {
  // Phase 2: the menu and the route guard stop reading a table compiled into
  // the app and start reading the school's own effective permissions, so an
  // administrator adding or removing one changes what opens straight away.
  const grantsFor = (role: string) =>
    Object.fromEntries(
      Object.entries(PERMISSIONS_BY_ROLE[role] ?? {}).map(([m, a]) => [m, a ?? []]),
    ) as Record<string, string[]>;

  it("opens for every role that holds the page today", () => {
    const cases: [string, string][] = [
      [FO, "/finance/collect"],
      [FO, "/salary/payroll"],
      [FO, "/expenses/list"],
      [FO, "/other-income"],
      [FO, "/sms/packages"],
      [AO, "/attendance/students"],
      [AO, "/student-cases"],
      [AM, "/promotions/promote"],
      [AM, "/academics/classes"],
      [AM, "/quiz/monitoring"],
      [EM, "/examinations/create"],
      [EM, "/quiz/create"],
      [RO, "/students"],
      [RO, "/parents"],
      [LIB, "/library"],
    ];
    for (const [role, path] of cases) {
      expect([role, path, canOpenWithPermissions(grantsFor(role), path)]).toEqual([
        role,
        path,
        true,
      ]);
    }
  });

  it("stays shut for every role that does not", () => {
    const cases: [string, string][] = [
      // The officer-management screens turn on "approve", which the officer
      // being managed is never granted.
      [AO, "/attendance/officers"],
      [AO, "/attendance/monitoring"],
      [AO, "/finance"],
      [FO, "/attendance/students"],
      [FO, "/examinations/create"],
      [FO, "/users"],
      [FO, "/settings"],
      // Reading the results is not running the exam.
      [AM, "/examinations/create"],
      [AM, "/quiz/create"],
      [AM, "/sms/packages"],
      [RO, "/finance/collect"],
      [LIB, "/examinations"],
      [LIB, "/id-cards"],
      [EM, "/students"],
    ];
    for (const [role, path] of cases) {
      expect([role, path, canOpenWithPermissions(grantsFor(role), path)]).toEqual([
        role,
        path,
        false,
      ]);
    }
  });

  it("closes a page the moment the school revokes the permission behind it", () => {
    // The whole point of Phase 2: this is what localStorage could never do.
    const finance = grantsFor(FO);
    expect(canOpenWithPermissions(finance, "/finance/collect")).toBe(true);
    expect(canOpenWithPermissions({ ...finance, fees: [] }, "/finance/collect")).toBe(
      false,
    );
  });

  it("opens a page the moment the school grants the permission", () => {
    const officer = grantsFor(AO);
    expect(canOpenWithPermissions(officer, "/library")).toBe(false);
    expect(
      canOpenWithPermissions({ ...officer, library: ["view"] }, "/library"),
    ).toBe(true);
  });

  it("lets anyone signed in reach their own profile and the notices", () => {
    for (const path of ["/dashboard", "/profile", "/announcements"]) {
      expect(canOpenWithPermissions({}, path)).toBe(true);
    }
  });

  it("refuses a page nobody has placed in the table", () => {
    expect(canOpenWithPermissions(grantsFor(UserRole.ADMINISTRATOR), "/brand-new")).toBe(
      false,
    );
  });

  describe("a report needs the module it reports on", () => {
    // Found while checking the menu against a revoked permission: the report
    // categories were falling through to the hub's own rule, so every role
    // holding "reports" could reach the school's fee and salary reporting.
    it("keeps a finance officer to the money it already holds", () => {
      const g = grantsFor(FO);
      expect(canOpenWithPermissions(g, "/reports/fees")).toBe(true);
      expect(canOpenWithPermissions(g, "/reports/salary")).toBe(true);
      expect(canOpenWithPermissions(g, "/reports/financial")).toBe(true);
      expect(canOpenWithPermissions(g, "/reports/students")).toBe(false);
      expect(canOpenWithPermissions(g, "/reports/examinations")).toBe(false);
    });

    it("keeps an attendance officer to attendance reporting", () => {
      const g = grantsFor(AO);
      expect(canOpenWithPermissions(g, "/reports/attendance")).toBe(true);
      expect(canOpenWithPermissions(g, "/reports/fees")).toBe(false);
      expect(canOpenWithPermissions(g, "/reports/salary")).toBe(false);
    });

    it("closes fee reporting the moment fees are revoked", () => {
      const g = { ...grantsFor(FO), fees: [] };
      expect(canOpenWithPermissions(g, "/reports/fees")).toBe(false);
      // The hub itself stays open; the role still has other reports.
      expect(canOpenWithPermissions(g, "/reports")).toBe(true);
    });
  });
});
