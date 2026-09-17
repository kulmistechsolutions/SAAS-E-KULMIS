import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A day that was marked has to come back marked.
 *
 * Every register carries the shift it was taken under, and the marking screen
 * refuses to open a day without one. Two things followed from that:
 *
 *  - 1,678 registers across thirteen schools were saved before those schools
 *    had shifts, so they carry no shiftId. Queried under a shift they matched
 *    nothing, the day came back empty, and the screen filled it with the
 *    school's default status. A child marked Late in September reopened as
 *    Present — and saving wrote a second row beside the first.
 *  - 271 more sit under shifts the school has since retired. Retired shifts
 *    were left out of the picker, so those days could not be opened at all.
 *
 * Neither is a display problem. A register that cannot be read back cannot be
 * corrected, and one that silently reads Present is worse than one that fails.
 */
const API = join(__dirname, "student-attendance.service.ts");
const WEB = join(__dirname, "..", "..", "..", "web", "src");

const service = readFileSync(API, "utf8");
const store = readFileSync(join(WEB, "lib", "attendance", "store.ts"), "utf8");
const page = readFileSync(
  join(WEB, "app", "(app)", "attendance", "students", "page.tsx"),
  "utf8",
);

describe("a register taken without a shift is still found", () => {
  it("falls back to the unshifted rows for that day", () => {
    const list = service.slice(
      service.indexOf("async list("),
      service.indexOf("async overview("),
    );
    expect(list).toContain(
      "where: { classId, sectionId, date, shiftId: null },",
    );
    expect(list).toMatch(/if \(shiftId\) \{[\s\S]{0,600}already\.has\(r\.studentId\)/);
  });

  it("never borrows another named shift's register", () => {
    // Two shifts are two registers on purpose; only the unshifted row is
    // adopted, and only for a student this shift has nothing for.
    const list = service.slice(
      service.indexOf("async list("),
      service.indexOf("async overview("),
    );
    expect(list).not.toMatch(/shiftId: \{ not: null \}/);
    expect(list).toContain("if (!already.has(r.studentId)) records.push(r);");
  });
});

describe("saving does not leave one child two registers for one morning", () => {
  it("gives the shift to the row already there", () => {
    expect(service).toContain("const strayId = strayByStudent.get(rec.studentId);");
    expect(service).toContain("if (shiftId && strayId) {");
    expect(service).toMatch(
      /if \(shiftId && strayId\) \{[\s\S]{0,400}tx\.studentAttendance\.update\(/,
    );
  });

  it("skips the adoption when this shift already holds a row", () => {
    // Moving the stray onto a shift that already has one would break the
    // unique index — and lose a mark.
    expect(service).toContain("const atThisShift = new Set(priorRows.map((r) => r.studentId));");
    expect(service).toContain("!atThisShift.has(r.studentId)");
  });
});

describe("a retired shift's days stay reachable", () => {
  it("lists retired shifts, active ones first", () => {
    expect(store).toContain("apiListAttendanceShifts(true)");
    expect(store).toContain('a.status === "ACTIVE" ? -1 : 1');
  });

  it("names them as retired rather than offering them as ordinary", () => {
    expect(page).toContain('attendanceShifts.retired');
    expect(page).toContain('s.status === "ACTIVE"');
  });
});

describe("the screen says whether the day is a record or a blank form", () => {
  it("counts what was already marked", () => {
    expect(service).toContain(
      "markedCount: students.filter((s) => byStudent.has(s.id)).length,",
    );
    expect(store).toContain("markedCount: res.markedCount ?? 0");
  });

  it("shows it either way", () => {
    expect(page).toContain("attendanceStudents.alreadyTaken");
    expect(page).toContain("attendanceStudents.notYetTaken");
  });
});

describe("the wording exists in every language", () => {
  const DICTS = join(WEB, "lib", "i18n", "dictionaries");
  for (const file of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
    it(`${file} carries the new keys`, () => {
      const d = readFileSync(join(DICTS, file), "utf8");
      for (const key of ["alreadyTaken:", "notYetTaken:", "retired:"]) {
        expect(d).toContain(`    ${key}`);
      }
    });
  }
});
