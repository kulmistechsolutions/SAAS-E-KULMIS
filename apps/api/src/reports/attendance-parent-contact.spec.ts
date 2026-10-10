import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Attendance lists are read to chase absences, so each student row carries
 * the parent's name and phone — the office rings home from the printout.
 */
const src = readFileSync(join(__dirname, "attendance-reports.service.ts"), "utf8");

describe("parent contact on student attendance reports", () => {
  it("fetches the parent's name and phone for the student", () => {
    expect(src).toContain("parent: { select: { name: true, phone: true } },");
  });

  it("shows Parent and Parent Phone on daily, monthly and history", () => {
    expect(src.split("...PARENT_COLUMNS,").length - 1).toBe(3);
    expect(src.split("...parentContact(").length - 1).toBe(3);
  });

  it("falls back to the student's own phone when no parent number is held", () => {
    expect(src).toContain("parentPhone: s?.parent?.phone || s?.phone || \"—\",");
  });

  it("finds a student by the parent's phone in the search box", () => {
    expect(src.split("contactMatches(r.student, q)").length - 1).toBe(2);
  });
});
