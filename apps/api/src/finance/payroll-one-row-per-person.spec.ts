import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * One person, one payroll row, one month — and every paid row backed by money.
 *
 * NUURULYAQIIN paid Kaamil $450 for August, then registered him as staff in
 * September. Generate Payroll matched only on ids, the August row carried
 * none, so he was added to the month a second time: a payroll of $3,380
 * against a real $2,930, with a second $450 sitting unpaid beside a settled
 * one. Six other rows across the estate read "Paid" with nothing in the salary
 * ledger behind them — settled on paper, unaccounted for anywhere a school
 * could check.
 */
const service = readFileSync(
  join(__dirname, "salaries.service.ts"),
  "utf8",
);
const store = readFileSync(
  join(__dirname, "..", "..", "..", "web", "src", "lib", "salary", "store.ts"),
  "utf8",
);

describe("payroll keeps one row per person per month", () => {
  it("adopts a row that carries a name but no id", () => {
    // Matching on ids alone is what let the same person onto one month twice.
    expect(service).toContain("teacherId: null,");
    expect(service).toContain("employeeId: null,");
    expect(service).toContain('mode: "insensitive"');
    expect(service).toMatch(/if \(unlinked\) \{/);
  });

  it("never creates a second row when it finds one to adopt", () => {
    // The adopt branch updates and returns; it must not fall through to create.
    const adopt = service.slice(
      service.indexOf("if (unlinked) {"),
      service.indexOf("const status = dto.status"),
    );
    expect(adopt).toContain("tx.salary.update(");
    expect(adopt).not.toContain("tx.salary.create(");
  });
});

describe("a paid row carries the money that makes it paid", () => {
  it("sets amountPaid when the row is created as PAID", () => {
    expect(service).toContain('amountPaid: status === "PAID" ? dto.amount : 0');
  });

  it("writes the payment record behind it", () => {
    expect(service).toContain("tx.salaryPayment.create(");
  });
});

describe("payroll opens on the month the school is in", () => {
  it("does not start on the newest month already generated", () => {
    // The old line took the maximum payrollMonth from existing rows, so a
    // school that ran August opened on August in September, pressed Generate,
    // and was told payroll already existed "this month".
    expect(store).not.toMatch(
      /activeMonth[\s\S]{0,200}payroll\.reduce\(/,
    );
    expect(store).toMatch(
      /const activeMonth = buildMonthKey\(\s*new Date\(\)\.getFullYear\(\)/,
    );
  });

  it("names the month it is talking about", () => {
    expect(store).not.toContain(
      "Payroll already generated for all active employees this month.",
    );
    expect(store).toContain(
      "already has payroll for ${monthLabel(payrollMonth)}",
    );
  });
});
