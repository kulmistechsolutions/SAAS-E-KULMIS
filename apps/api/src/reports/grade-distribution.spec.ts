import { ExamReportsService } from "./exam-reports.service";

/**
 * The Grade Distribution report listed only A+, A, B, C, D and F, so a
 * school whose ladder has an E lost those students from the table while the
 * "Graded" total still counted them.
 */
const matrix = (grades: string[]) => ({
  rows: grades.map((g, i) => ({ studentCode: `S${i}`, studentName: `S${i}`, grade: g })),
});
const svc = new ExamReportsService({} as never, {} as never);
const run = (grades: string[], ladder: string[]) =>
  (svc as never as { gradeDistribution: (m: unknown, l: string[]) => { rows: { grade: string; count: number }[]; summary: { value: string }[] } })
    .gradeDistribution(matrix(grades), ladder);

describe("grade distribution", () => {
  const LADDER = ["A", "B", "C", "D", "E", "F"];

  it("keeps the students who earned an E", () => {
    const r = run(["A", "E", "E", "F", "B"], LADDER);
    expect(r.rows).toEqual([
      { grade: "A", count: 1 }, { grade: "B", count: 1 },
      { grade: "E", count: 2 }, { grade: "F", count: 1 },
    ]);
    expect(r.rows.reduce((n, x) => n + x.count, 0)).toBe(Number(r.summary[0]!.value));
  });

  it("follows the school's own grade names and order", () => {
    const r = run(["Haray", "Gudbay", "Gudbay"], ["Gudbay", "Haray"]);
    expect(r.rows.map((x) => x.grade)).toEqual(["Gudbay", "Haray"]);
  });

  it("still shows a grade that is no longer on the ladder, last", () => {
    const r = run(["A", "A-"], ["A", "B"]);
    expect(r.rows.map((x) => x.grade)).toEqual(["A", "A-"]);
  });
});
