import { readFileSync } from "node:fs";
import { join } from "node:path";
import { rosterRanks, spreadTies, type RosterRow } from "./roster";

/**
 * A student's S/N is their place in their class register.
 *
 * The complaint that started this: a class had S/N 1–5, a sixth student was
 * registered, and instead of being 6 the newcomer became 1 and everyone else
 * moved down. These pin the register's rules down in that school's terms.
 */
const t = (min: number) => new Date(Date.UTC(2026, 8, 1, 8, min));
const row = (id: string, classId: string, min: number, code = id): RosterRow => ({
  id,
  classId,
  rosterAt: t(min),
  code,
});

describe("the class register", () => {
  const five = [
    row("a", "g5", 1, "STU0001"),
    row("b", "g5", 2, "STU0002"),
    row("c", "g5", 3, "STU0003"),
    row("d", "g5", 4, "STU0004"),
    row("e", "g5", 5, "STU0005"),
  ];

  it("numbers a class from 1 in the order students joined it", () => {
    const r = rosterRanks(five);
    expect(["a", "b", "c", "d", "e"].map((id) => r.get(id))).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts a sixth student at 6, and moves nobody", () => {
    const r = rosterRanks([...five, row("new", "g5", 60, "STU0006")]);
    expect(r.get("new")).toBe(6);
    expect(["a", "b", "c", "d", "e"].map((id) => r.get(id))).toEqual([1, 2, 3, 4, 5]);
  });

  it("puts a newcomer at the end even if their name sorts first", () => {
    // The name is not the order; the register is.
    const r = rosterRanks([...five, row("aaron", "g5", 60, "STU0006")]);
    expect(r.get("aaron")).toBe(6);
  });

  it("closes the gap when a student is deleted", () => {
    const r = rosterRanks(five.filter((s) => s.id !== "b"));
    expect(["a", "c", "d", "e"].map((id) => r.get(id))).toEqual([1, 2, 3, 4]);
  });

  it("gives a replacement the deleted student's place when it takes their moment", () => {
    const withoutC = five.filter((s) => s.id !== "c");
    const r = rosterRanks([...withoutC, { id: "new", classId: "g5", rosterAt: t(3), code: "STU0009" }]);
    expect(r.get("new")).toBe(3);
    expect(["a", "b", "d", "e"].map((id) => r.get(id))).toEqual([1, 2, 4, 5]);
  });

  it("counts each class on its own", () => {
    const r = rosterRanks([row("x", "g5", 9), row("y", "g6", 1), row("z", "g6", 2)]);
    expect(r.get("x")).toBe(1);
    expect(r.get("y")).toBe(1);
    expect(r.get("z")).toBe(2);
  });

  it("orders a batch entered in one instant by ID, as a person reads them", () => {
    const same = new Date(Date.UTC(2026, 8, 1));
    const r = rosterRanks([
      { id: "10", classId: "g5", rosterAt: same, code: "STU0010" },
      { id: "9", classId: "g5", rosterAt: same, code: "STU009" },
      { id: "2", classId: "g5", rosterAt: same, code: "STU2" },
    ]);
    expect([r.get("2"), r.get("9"), r.get("10")]).toEqual([1, 2, 3]);
  });
});

describe("replacing one of a batch entered in one instant", () => {
  it("still lands the newcomer exactly in the place they were given", () => {
    // Five imported at once; the third is replaced by a student with a new,
    // higher ID. Without spreading, the newcomer would sort last.
    const base = new Date(Date.UTC(2026, 8, 1));
    const batch = ["STU0001", "STU0002", "STU0003", "STU0004", "STU0005"].map((code, i) => ({
      id: String(i + 1),
      code,
    }));
    const spread = spreadTies(base, batch);

    const rows: RosterRow[] = batch
      .filter((b) => b.id !== "3")
      .map((b) => ({ id: b.id, classId: "g5", rosterAt: spread.get(b.id)!, code: b.code }));
    rows.push({ id: "new", classId: "g5", rosterAt: spread.get("3")!, code: "STU0099" });

    const r = rosterRanks(rows);
    expect(r.get("new")).toBe(3);
    expect(["1", "2", "4", "5"].map((id) => r.get(id))).toEqual([1, 2, 4, 5]);
  });

  it("changes nobody's S/N by spreading", () => {
    const base = new Date(Date.UTC(2026, 8, 1));
    const batch = [
      { id: "a", code: "STU0003" },
      { id: "b", code: "STU0001" },
      { id: "c", code: "STU0002" },
    ];
    const before = rosterRanks(batch.map((b) => ({ ...b, classId: "g", rosterAt: base })));
    const spread = spreadTies(base, batch);
    const after = rosterRanks(batch.map((b) => ({ ...b, classId: "g", rosterAt: spread.get(b.id)! })));
    expect([...after.entries()].sort()).toEqual([...before.entries()].sort());
  });
});

const service = readFileSync(join(__dirname, "students.service.ts"), "utf8");
const controller = readFileSync(join(__dirname, "students.controller.ts"), "utf8");
const migration = readFileSync(
  join(__dirname, "..", "..", "prisma", "migrations", "20261004090000_student_roster_order", "migration.sql"),
  "utf8",
);
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const read = (...p: string[]) => readFileSync(join(WEB, ...p), "utf8");

describe("replacing a student", () => {
  it("deletes and registers in one transaction, so a failure keeps the old student", () => {
    // The delete sits inside registerOnce's forTenant callback, before the
    // create — not in a separate call that would commit on its own.
    const body = service.slice(service.indexOf("async register("), service.indexOf("async replace("));
    const tx = body.indexOf("this.prisma.forTenant(schoolId, async (tx) =>");
    const del = body.indexOf("await tx.student.delete({ where: { id: row.id } });");
    const create = body.indexOf("await tx.student.create(");
    expect(tx).toBeGreaterThan(0);
    expect(del).toBeGreaterThan(tx);
    expect(create).toBeGreaterThan(del);
  });

  it("keeps the ID only when asked", () => {
    expect(service).toContain("old && replace?.keepCode");
  });

  it("keeps the S/N only when asked, and only in the same class", () => {
    expect(service).toContain("old && replace?.keepSerial ? { rosterAt: old.rosterAt }");
    expect(service).toContain("replace.keepSerial && dto.classId !== row.classId");
  });

  it("does not hold a replacement to the plan's student limit", () => {
    expect(service).toContain("if (!replace) await this.subscriptions.assertCanAddStudent(schoolId);");
  });

  it("removes the old family only if the newcomer is not theirs", () => {
    expect(service).toContain("if (old.parentId !== student.parentId)");
  });

  it("is written to the audit log, with who did it", () => {
    expect(service).toContain('action: "STUDENT_REPLACED"');
    expect(controller).toContain("this.students.replace(me.schoolId, id, parsed.data, {");
  });

  it("is held to the people who may delete students", () => {
    const at = controller.indexOf('@Post(":id/replace")');
    const head = controller.slice(controller.lastIndexOf("@Roles", at), at);
    expect(head).toContain("UserRole.ADMINISTRATOR");
    expect(head).toContain('"students.delete"');
  });
});

describe("the register is kept", () => {
  it("backfills every existing student in the order they were entered", () => {
    expect(migration).toContain('UPDATE "students" SET "rosterAt" = "createdAt";');
  });

  it("puts a student moved on their own at the end of their new class", () => {
    expect(service).toContain("dto.classId !== undefined && dto.classId !== current.classId");
    expect(service).toContain("? { rosterAt: new Date() }");
  });

  it("ranks over the whole class, not over the filtered rows", () => {
    expect(service).toContain("where: { classId: { in: classIds } }");
  });
});

describe("the students list", () => {
  const page = read("app", "(app)", "students", "page.tsx");

  it("opens in register order", () => {
    expect(page).toContain('useState<SortKey>("serial")');
    expect(page).toContain('useState<SortDir>("asc")');
  });

  it("shows the class S/N, not the row's place on the page", () => {
    expect(page).toContain("{s.serialNo ?? \"—\"}");
    expect(page).not.toContain("(currentPage - 1) * pageSize + i + 1");
  });

  it("offers the replacement from the delete dialog", () => {
    expect(page).toContain('label: t("studentReplace.action")');
    expect(page).toContain("replacing={replacing}");
  });

  it("lets the school keep the ID, the S/N, both or neither", () => {
    const form = read("components", "students", "student-form-dialog.tsx");
    expect(form).toContain("checked={keepCode}");
    expect(form).toContain("checked={keepSerial}");
  });
});
