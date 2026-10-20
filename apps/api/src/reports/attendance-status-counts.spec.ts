import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A school asked for each student's whole attendance picture: not just
 * Present, but Late, Absent and Excused too, in the history, daily and
 * monthly reports.
 */
const src = readFileSync(join(__dirname, "attendance-reports.service.ts"), "utf8");

describe("attendance reports count every status", () => {
  it("summaries show Present, Late, Absent, Excused and the rate", () => {
    for (const label of ['"Present"', '"Late"', '"Absent"', '"Excused"', '"Rate"']) {
      expect(src).toContain(`{ label: ${label}, value:`);
    }
  });

  it("daily and history use the shared counter", () => {
    expect(src.split("...statusSummary(filtered.map((r) => r.status)),").length - 1).toBe(2);
  });

  it("monthly gives each student a column for every status", () => {
    for (const key of ["presentOnly", "late", "absent", "excused"]) {
      expect(src).toContain(`{ key: "${key}", label:`);
    }
  });

  it("still counts Late as attending in the rate", () => {
    expect(src).toContain("pct(c.present + c.late, statuses.length)");
  });
});
