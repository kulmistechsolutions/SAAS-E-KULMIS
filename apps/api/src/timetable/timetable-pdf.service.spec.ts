import { TimetablePdfService } from "./timetable-pdf.service";

/**
 * Smoke test for the drawing code. Loading the timetable needs a database, but
 * rendering does not — and rendering is where a bad pdfkit call silently
 * produces a corrupt file. Building a real document from synthetic data catches
 * that without any infrastructure.
 */
describe("TimetablePdfService rendering", () => {
  // The service only needs Prisma and storage to LOAD data; render is pure.
  const service = new TimetablePdfService(
    null as never,
    null as never,
    null as never,
  );
  const render = (
    service as unknown as {
      render: (opts: unknown) => Promise<Buffer>;
    }
  ).render.bind(service);

  const days = [6, 0, 1, 2, 3];
  const periods = [
    { name: "P1", label: "07:50 – 08:33" },
    { name: "P2", label: "08:33 – 09:16" },
    { name: "P3", label: "09:16 – 10:00" },
    { name: "P4", label: "10:30 – 11:00" },
  ];

  const grid = (title: string) => ({
    title,
    subtitle: "20 lessons / week",
    breakAfter: new Map([[2, "Break  10:00 – 10:30"]]),
    rows: periods.map((_, r) =>
      days.map((_d, c) =>
        // Leave one hole so the free-period path is exercised too.
        r === 3 && c === 4 ? null : { top: "Mathematics", bottom: "M. Cumar" },
      ),
    ),
  });

  const opts = {
    schoolName: "Test Secondary School",
    logo: null,
    academicYear: "2025 / 2026",
    shiftName: "Morning",
    days,
    periods,
    totalLessons: 120,
    classCount: 6,
    teacherCount: 9,
    notes: "8thB Somali: 8 periods across 5 days, so it repeats on some days.",
    classGrids: ["F1", "F2", "F3", "F4", "8thA", "8thB"].map(grid),
    teacherGrids: ["M. Cumar", "M. Axmed", "M. Sudeys"].map(grid),
  };

  it("produces a valid, non-trivial PDF", async () => {
    const buffer = await render(opts);
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
    expect(buffer.subarray(-6).toString()).toContain("EOF");
    // Nine grids across several pages: anything tiny means drawing bailed out.
    expect(buffer.length).toBeGreaterThan(10_000);
  });

  it("survives a school with a single day and no notes", async () => {
    const buffer = await render({
      ...opts,
      days: [1],
      notes: null,
      classGrids: [{ ...grid("Only"), rows: [[null]] , breakAfter: new Map() }],
      teacherGrids: [],
    });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });

  it("does not fail when there is nothing to draw", async () => {
    const buffer = await render({
      ...opts,
      classGrids: [],
      teacherGrids: [],
    });
    expect(buffer.subarray(0, 5).toString()).toBe("%PDF-");
  });
});
