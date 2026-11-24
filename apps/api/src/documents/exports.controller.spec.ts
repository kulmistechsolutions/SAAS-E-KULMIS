import ExcelJS from "exceljs";
import { ExportsController } from "./exports.controller";
import { DocumentsService } from "./documents.service";

/**
 * The export door: any table in, a branded PDF or a real .xlsx out.
 */
function harness() {
  const prisma = {
    school: {
      findFirst: jest.fn().mockResolvedValue({ name: "Test School", logoKey: null }),
    },
  };
  const controller = new ExportsController(
    new DocumentsService(),
    prisma as never,
    { getObject: jest.fn() } as never,
    { get: () => "ekulmis" } as never,
  );
  const sent: { headers: Record<string, string>; body?: Buffer } = { headers: {} };
  const res = {
    setHeader: (k: string, v: string) => {
      sent.headers[k.toLowerCase()] = v;
    },
    send: (b: Buffer) => {
      sent.body = b;
    },
  };
  return { controller, res, sent };
}

const me = { schoolId: "s1", userId: "u1", username: "admin", role: "ADMINISTRATOR" } as never;
const table = {
  title: "Student List",
  subtitle: ["Academic Year: 2026-2027"],
  columns: [
    { key: "code", label: "Student ID" },
    { key: "name", label: "Full Name" },
    { key: "fee", label: "Monthly Fee", align: "right" },
  ],
  rows: [
    { code: "MDFS0001", name: "Cabdi Axmed", fee: 10 },
    { code: "MDFS0002", name: "Xaawo Cali", fee: 12.5 },
  ],
};

describe("ExportsController", () => {
  it("builds a real xlsx with the school name, title, header and every row", async () => {
    const { controller, res, sent } = harness();
    await controller.table(me, { ...table, format: "xlsx" }, res as never);
    expect(sent.headers["content-type"]).toContain("spreadsheetml");
    expect(sent.headers["content-disposition"]).toContain("student-list.xlsx");
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(sent.body as unknown as ArrayBuffer);
    const ws = wb.worksheets[0]!;
    const values = ws
      .getSheetValues()
      .filter(Boolean)
      .map((r) => (Array.isArray(r) ? r.filter((v) => v !== undefined && v !== null) : []));
    const flat = values.map((r) => r.join("|"));
    // Title rows are merged across the table, so read their first cell.
    expect(ws.getRow(1).getCell(1).value).toBe("Test School");
    expect(ws.getRow(2).getCell(1).value).toBe("Student List");
    expect(flat).toContain("#|Student ID|Full Name|Monthly Fee");
    expect(flat).toContain("1|MDFS0001|Cabdi Axmed|10");
    expect(flat).toContain("2|MDFS0002|Xaawo Cali|12.5");
  });

  it("builds a PDF", async () => {
    const { controller, res, sent } = harness();
    await controller.table(me, { ...table, format: "pdf" }, res as never);
    expect(sent.headers["content-type"]).toBe("application/pdf");
    expect(sent.body!.subarray(0, 4).toString()).toBe("%PDF");
  });

  it("puts the school's banner on the PDF when it has one", async () => {
    const png = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==",
      "base64",
    );
    const getObject = jest.fn().mockResolvedValue(png);
    const controller = new ExportsController(
      new DocumentsService(),
      {
        school: {
          findFirst: jest.fn().mockResolvedValue({
            name: "Test School",
            logoKey: null,
            headerImageKey: "s1/school/header.png",
            headerImageEnabled: true,
            headerImageHeightMm: 0,
          }),
        },
      } as never,
      { getObject } as never,
      { get: () => "ekulmis" } as never,
    );
    let body: Buffer | undefined;
    await controller.table(
      me,
      { ...table, format: "pdf" },
      { setHeader: () => undefined, send: (b: Buffer) => (body = b) } as never,
    );
    expect(getObject).toHaveBeenCalledWith("ekulmis", "s1/school/header.png");
    expect(body!.toString("latin1")).toContain("/Subtype /Image");
  });

  it("refuses an unknown format", async () => {
    const { controller, res } = harness();
    await expect(
      controller.table(me, { ...table, format: "exe" }, res as never),
    ).rejects.toThrow();
  });
});
