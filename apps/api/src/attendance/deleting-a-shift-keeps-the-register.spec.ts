import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A shift a school no longer wants has to actually go — without taking the
 * register with it.
 *
 * Pressing the bin said "Removed" and then left the shift sitting in the list,
 * because the only thing it did was set the status to INACTIVE. Retiring is
 * still right for a shift that holds history; it was wrong as the only answer,
 * and wrong to describe as removal.
 *
 * So the school sees what is riding on it first — how many registers, over
 * which dates, how many teachers — and then chooses. Deleting keeps every
 * attendance record: the FK is `onDelete: SetNull`, and the marking screen
 * already falls back to the unshifted rows, so those days stay readable.
 */
const HERE = __dirname;
const WEB = join(HERE, "..", "..", "..", "web", "src");

const service = readFileSync(join(HERE, "attendance-shifts.service.ts"), "utf8");
const controller = readFileSync(
  join(HERE, "attendance-shifts.controller.ts"),
  "utf8",
);
const schema = readFileSync(
  join(HERE, "..", "..", "prisma", "schema.prisma"),
  "utf8",
);
const dialog = readFileSync(
  join(WEB, "components", "attendance", "shift-delete-dialog.tsx"),
  "utf8",
);

describe("the register survives its shift", () => {
  it("nulls the shift on an attendance row rather than deleting it", () => {
    // The single line standing between a school deleting a shift and losing
    // every mark taken under it.
    const studentAttendance = schema.slice(
      schema.indexOf("model StudentAttendance"),
      schema.indexOf("model AttendanceShift"),
    );
    expect(studentAttendance).toContain(
      "shift   AttendanceShift? @relation(fields: [shiftId], references: [id], onDelete: SetNull)",
    );
    expect(studentAttendance).not.toMatch(
      /shift\s+AttendanceShift\?[^\n]*onDelete: Cascade/,
    );
  });

  it("does the same for the teachers' own register", () => {
    const teacherAttendance = schema.slice(
      schema.indexOf("model TeacherAttendance"),
    );
    expect(teacherAttendance.slice(0, 1200)).toContain(
      "onDelete: SetNull",
    );
  });
});

describe("a school is told what it is deleting", () => {
  it("counts everything that points at the shift", () => {
    for (const table of [
      "tx.studentAttendance.count({ where: { shiftId: id } })",
      "tx.teacherAttendance.count({ where: { shiftId: id } })",
      "tx.teacherAssignment.count({ where: { shiftId: id } })",
      "tx.teacherShift.count({ where: { shiftId: id } })",
      "tx.attendanceAssignment.count({ where: { shiftId: id } })",
    ]) {
      expect(service).toContain(table);
    }
  });

  it("says which dates the registers cover", () => {
    expect(service).toContain("_min: { date: true }");
    expect(service).toContain("_max: { date: true }");
  });

  it("serves it to the screen that asks", () => {
    expect(controller).toContain('@Get(":id/usage")');
    expect(dialog).toContain("apiAttendanceShiftUsage(shift.id)");
  });

  it("shows the counts and will not delete until they are acknowledged", () => {
    expect(dialog).toContain("attendanceShifts.usageTitle");
    expect(dialog).toContain("attendanceShifts.usageStudents");
    expect(dialog).toContain("records > 0 && !confirmed");
  });
});

describe("retiring and deleting are both offered", () => {
  it("still retires by default", () => {
    expect(service).toContain("if (!opts.hard) {");
    expect(service).toContain('data: { status: "INACTIVE" }');
    expect(service).toContain("return { success: true, deleted: false };");
  });

  it("deletes for real when asked", () => {
    expect(service).toContain("await tx.attendanceShift.delete({ where: { id } });");
    expect(controller).toContain('@Query("hard") hard?: string,');
    expect(controller).toContain('{ hard: hard === "true" }');
  });

  it("does not offer retiring a shift that is already retired", () => {
    expect(dialog).toContain('shift?.status === "ACTIVE" && (');
  });
});
