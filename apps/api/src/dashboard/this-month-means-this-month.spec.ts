import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * "Income vs Expense (This Month)" has to mean this month.
 *
 * HANUUNIYE read $1,899 income beside a fee card reading $1,872 for the same
 * month. Neither figure was wrong about what it measured: the fee card had
 * September, and the income panel had every payment the school had ever taken.
 * The $27 between them was $15 on 30 August and $12 on 31 August.
 *
 * The five money aggregates behind that panel carried no `where` at all, so
 * thirteen of the nineteen schools holding fee payments were reading $8,617 of
 * earlier months as this month's income — and Net Income, struck from the same
 * pair, was wrong by whatever the school had ever taken and spent.
 *
 * FinanceService.dashboard has always scoped these correctly. The window is
 * written the same way here so the two cannot drift apart again.
 */
const service = readFileSync(
  join(__dirname, "dashboard.service.ts"),
  "utf8",
);

describe("the dashboard's money covers the month it names", () => {
  it("bounds the month once and uses it", () => {
    expect(service).toContain(
      "const startOfNextMonth = new Date(Date.UTC(y, mo + 1, 1));",
    );
    expect(service).toContain(
      "const thisMonth = { gte: startOfMonth, lt: startOfNextMonth };",
    );
  });

  it("scopes fee income", () => {
    expect(service).toContain(
      "tx.payment.aggregate({ _sum: { amount: true }, where: { paidAt: thisMonth } })",
    );
  });

  it("scopes the income that never passes through fees", () => {
    expect(service).toMatch(
      /tx\.otherIncome\.aggregate\(\{[\s\S]{0,120}where: \{ receivedAt: thisMonth \}/,
    );
  });

  it("scopes expenses and debt repayments", () => {
    expect(service).toMatch(
      /tx\.expense\.aggregate\(\{[\s\S]{0,120}where: \{ spentAt: thisMonth \}/,
    );
    expect(service).toMatch(
      /tx\.schoolDebtRepayment\.aggregate\(\{[\s\S]{0,120}where: \{ paidAt: thisMonth \}/,
    );
  });

  it("names the month for payroll, which is filed by year and month", () => {
    expect(service).toMatch(
      /tx\.salary\.aggregate\(\{[\s\S]{0,160}where: \{ year: y, month: mo \+ 1 \}/,
    );
  });

  it("leaves no money aggregate unbounded", () => {
    for (const unscoped of [
      "tx.payment.aggregate({ _sum: { amount: true } })",
      "tx.otherIncome.aggregate({ _sum: { amount: true } })",
      "tx.expense.aggregate({ _sum: { amount: true } })",
      "tx.salary.aggregate({ _sum: { amountPaid: true } })",
      "tx.schoolDebtRepayment.aggregate({ _sum: { amount: true } })",
    ]) {
      expect(service).not.toContain(unscoped);
    }
  });
});
