import ExcelJS from "exceljs";
import { MarksImportService } from "./marks-import.service";

/**
 * Round-trip test: build the template, fill it in the way a school would, then
 * validate it back.
 *
 * Marks that go in wrong are close to impossible to spot afterwards — the
 * damage shows up as a student's reported result — so the validator is tested
 * against real workbooks rather than hand-built objects.
 */

const EXAMS = [
  {
    id: "ex8A",
    name: "Midterm 2026",
    maxMarks: 100,
    classId: "c8",
    sectionId: "sA",
    class: { id: "c8", name: "8th" },
    section: { id: "sA", name: "A" },
    subjects: [
      { subject: { id: "sub-math", name: "Mathematics" } },
      { subject: { id: "sub-eng", name: "English" } },
    ],
  },
  {
    id: "ex8B",
    name: "Midterm 2026",
    maxMarks: 100,
    classId: "c8",
    sectionId: "sB",
    class: { id: "c8", name: "8th" },
    section: { id: "sB", name: "B" },
    // Deliberately a DIFFERENT subject list — the whole point of a sheet per
    // class is that each carries only what that class actually sits.
    subjects: [{ subject: { id: "sub-sci", name: "Saynis" } }],
  },
];

const STUDENTS: Record<string, { id: string; code: string; fullName: string }[]> = {
  sA: [
    { id: "st1", code: "S001", fullName: "Amina Cali" },
    { id: "st2", code: "S002", fullName: "Bashir Nuur" },
  ],
  sB: [{ id: "st3", code: "S003", fullName: "Caasho Xasan" }],
};

/** Minimal stand-in for the tenant client the service asks for. */
function fakePrisma() {
  const tx = {
    exam: {
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(EXAMS.filter((e) => where.id.in.includes(e.id))),
    },
    student: {
      findMany: ({ where }: { where: { sectionId?: string } }) =>
        Promise.resolve(STUDENTS[where.sectionId ?? ""] ?? []),
    },
  };
  return {
    forTenant: <T>(_schoolId: string, fn: (t: unknown) => Promise<T>) => fn(tx),
  };
}

const service = new MarksImportService(fakePrisma() as never);
const EXAM_IDS = ["ex8A", "ex8B"];

async function openTemplate() {
  const { buffer } = await service.buildTemplate("s1", EXAM_IDS);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

async function toBuffer(wb: ExcelJS.Workbook) {
  return Buffer.from(await wb.xlsx.writeBuffer());
}

describe("marks template", () => {
  it("gives every class its own sheet, students and subjects", async () => {
    const wb = await openTemplate();
    expect(wb.worksheets.map((w) => w.name)).toEqual(["8th A", "8th B"]);

    const a = wb.getWorksheet("8th A")!;
    expect(a.getRow(4).values).toEqual(
      expect.arrayContaining(["Student ID", "Student Name", "Mathematics", "English"]),
    );
    expect(String(a.getCell("A5").value)).toBe("S001");
    expect(String(a.getCell("B6").value)).toBe("Bashir Nuur");

    // 8B sits Saynis and must NOT be offered 8A's subjects.
    const b = wb.getWorksheet("8th B")!;
    const bHeaders = (b.getRow(4).values as unknown[]).map((v) => String(v ?? ""));
    expect(bHeaders).toContain("Saynis");
    expect(bHeaders).not.toContain("Mathematics");
  });

  it("stamps the exam id so a renamed tab cannot go to the wrong class", async () => {
    const wb = await openTemplate();
    expect(String(wb.getWorksheet("8th A")!.getCell("A2").value)).toBe("EXAM_ID:ex8A");
  });
});

describe("marks validation", () => {
  /** Fill a subject cell for a student row. */
  function put(ws: ExcelJS.Worksheet, row: number, header: string, value: unknown) {
    let col = 0;
    ws.getRow(4).eachCell((cell, c) => {
      if (String(cell.value ?? "").trim() === header) col = c;
    });
    ws.getCell(row, col).value = value as never;
  }

  it("accepts a correctly filled workbook", async () => {
    const wb = await openTemplate();
    const a = wb.getWorksheet("8th A")!;
    put(a, 5, "Mathematics", 85);
    put(a, 5, "English", 72);
    put(a, 6, "Mathematics", 64);
    put(a, 6, "English", 58);
    put(wb.getWorksheet("8th B")!, 5, "Saynis", 91);

    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.issues).toEqual([]);
    expect(res.ok).toBe(true);
    expect(res.totalMarks).toBe(5);
    expect(res.sheets.map((s) => s.className)).toEqual(["8th A", "8th B"]);
  });

  it("rejects a mark above the exam maximum", async () => {
    const wb = await openTemplate();
    put(wb.getWorksheet("8th A")!, 5, "Mathematics", 140);
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.message.includes("outside 0–100"))).toBe(true);
  });

  it("rejects text where a mark should be", async () => {
    const wb = await openTemplate();
    put(wb.getWorksheet("8th A")!, 5, "Mathematics", "eighty");
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.issues.some((i) => i.message.includes("is not a number"))).toBe(true);
  });

  it("rejects a student id that is not in that class", async () => {
    const wb = await openTemplate();
    // S003 is real, but belongs to 8th B — putting it on 8th A must not pass.
    wb.getWorksheet("8th A")!.getCell("A5").value = "S003";
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.ok).toBe(false);
    expect(
      res.issues.some((i) => i.message.includes('No active student "S003" in 8th A')),
    ).toBe(true);
  });

  it("catches the same student listed twice", async () => {
    const wb = await openTemplate();
    wb.getWorksheet("8th A")!.getCell("A6").value = "S001";
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.issues.some((i) => i.message.includes("more than once"))).toBe(true);
  });

  it("flags a subject column that does not belong to the exam", async () => {
    const wb = await openTemplate();
    wb.getWorksheet("8th A")!.getCell(4, 9).value = "Chemistry";
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(
      res.issues.some((i) => i.message.includes('Column "Chemistry" is not a subject')),
    ).toBe(true);
  });

  it("reports a missing sheet instead of importing part of the school", async () => {
    const wb = await openTemplate();
    wb.removeWorksheet(wb.getWorksheet("8th B")!.id);
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.message.includes("No sheet found for 8th B"))).toBe(
      true,
    );
  });

  it("still finds a sheet the school renamed, via the stamped exam id", async () => {
    const wb = await openTemplate();
    wb.getWorksheet("8th A")!.name = "Fasalka 8A";
    put(wb.getWorksheet("Fasalka 8A")!, 5, "Mathematics", 70);
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(res.issues.some((i) => i.message.includes("No sheet found"))).toBe(false);
    expect(res.totalMarks).toBe(1);
  });

  it("treats blank cells as 'not entered', not as zero", async () => {
    const wb = await openTemplate();
    put(wb.getWorksheet("8th A")!, 5, "Mathematics", 55);
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    const a = res.sheets.find((s) => s.className === "8th A")!;
    expect(a.marks).toBe(1);
    expect(a.blanks).toBe(3);
  });

  it("names students who were left off the sheet", async () => {
    const wb = await openTemplate();
    const a = wb.getWorksheet("8th A")!;
    a.getCell("A6").value = null; // drop Bashir's row
    const res = await service.validate("s1", EXAM_IDS, await toBuffer(wb));
    expect(
      res.issues.some((i) => i.message.includes("Bashir Nuur is in 8th A")),
    ).toBe(true);
  });

  it("refuses a file that is not a workbook", async () => {
    await expect(
      service.validate("s1", EXAM_IDS, Buffer.from("this is not xlsx")),
    ).rejects.toThrow(/could not be opened/i);
  });
});
