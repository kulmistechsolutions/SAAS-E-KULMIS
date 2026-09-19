import { duplicatePeople } from "@ekulmis/shared";

/** The two fields the detector reads, plus what the page carries alongside. */
interface PayrollRow {
  payrollId: string;
  employeeName: string;
  netSalary: number;
  amountPaid: number;
  status: string;
}

/**
 * A month that already carries a duplicate stays wrong until somebody takes
 * the extra row off — and until now nothing on the screen said so.
 *
 * NUURULYAQIIN's August reads $3,380 against a real $2,930 because Kaamil is
 * on it twice: once as a paid name with no staff id, once as the employee he
 * was registered as in September. Generate Payroll cannot do it again, but the
 * row already there is only removable by someone who first notices a repeated
 * name in a list of twelve and works the arithmetic out for themselves.
 */
function row(over: Partial<PayrollRow>): PayrollRow {
  return {
    payrollId: "p1",
    employeeId: "e1",
    employeeCode: "EMP001",
    employeeName: "Kaamil Axmad Ibraahim",
    position: "Teacher",
    type: "TEACHER",
    payrollMonth: "2026-08",
    netSalary: 450,
    amountPaid: 450,
    remainingBalance: 0,
    status: "PAID",
    ...over,
  } as PayrollRow;
}

describe("finding one person on a month twice", () => {
  it("says nothing about a clean month", () => {
    expect(
      duplicatePeople([
        row({ payrollId: "a", employeeName: "Cawil Cilmi warsame" }),
        row({ payrollId: "b", employeeName: "Sahro idris Axmed" }),
      ]),
    ).toEqual([]);
  });

  it("finds the pair and names the person", () => {
    const found = duplicatePeople([
      row({ payrollId: "a" }),
      row({ payrollId: "b", amountPaid: 0, status: "PENDING" }),
      row({ payrollId: "c", employeeName: "Sahro idris Axmed", netSalary: 60 }),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]!.name).toBe("Kaamil Axmad Ibraahim");
    expect(found[0]!.rows).toHaveLength(2);
  });

  it("reports what the month is overstated by", () => {
    // Everything past the first row. NUURULYAQIIN: $3,380 - $450 = $2,930.
    const found = duplicatePeople([
      row({ payrollId: "a" }),
      row({ payrollId: "b", amountPaid: 0, status: "PENDING" }),
    ]);
    expect(found[0]!.extra).toBe(450);
  });

  it("matches names the way a duplicate actually looks", () => {
    // The ids are exactly what the two rows disagree about, and a name typed
    // twice is rarely typed identically.
    const found = duplicatePeople([
      row({ payrollId: "a", employeeName: "Kaamil Axmad Ibraahim" }),
      row({ payrollId: "b", employeeName: "  kaamil   axmad ibraahim " }),
    ]);
    expect(found).toHaveLength(1);
  });

  it("ignores a row with no name at all", () => {
    // Blank is not a person, and two blanks are not the same person twice.
    expect(
      duplicatePeople([
        row({ payrollId: "a", employeeName: "" }),
        row({ payrollId: "b", employeeName: "   " }),
      ]),
    ).toEqual([]);
  });

  it("handles three of the same person", () => {
    const found = duplicatePeople([
      row({ payrollId: "a" }),
      row({ payrollId: "b" }),
      row({ payrollId: "c" }),
    ]);
    expect(found[0]!.rows).toHaveLength(3);
    expect(found[0]!.extra).toBe(900);
  });

  it("keeps the first row as the one that stands", () => {
    const found = duplicatePeople([
      row({ payrollId: "keep" }),
      row({ payrollId: "extra" }),
    ]);
    expect(found[0]!.rows[0]!.payrollId).toBe("keep");
  });
});
