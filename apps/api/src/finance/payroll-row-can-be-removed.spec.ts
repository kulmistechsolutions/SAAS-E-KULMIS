import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A payroll row that should never have existed has to be removable.
 *
 * NUURULYAQIIN's August read $3,380 against a real $2,930: Kaamil was on the
 * month twice, once as a paid name with no staff id and once as a freshly
 * registered employee. Generate Payroll now adopts the unlinked row, so it
 * cannot happen again — but the row already there was permanent. The API has
 * had DELETE /salaries/:id and the `salaries.delete` permission all along; the
 * payroll page simply never offered it, so the only way to correct a month was
 * to write to the database by hand.
 *
 * The offer is narrow on purpose: a row with money against it is an account of
 * cash that left the school, and deleting it would take its payment history
 * with it. Those are reversed instead.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");

const page = readFileSync(
  join(WEB, "app", "(app)", "salary", "payroll", "page.tsx"),
  "utf8",
);
const store = readFileSync(join(WEB, "lib", "salary", "store.ts"), "utf8");
const api = readFileSync(join(WEB, "lib", "salary", "api.ts"), "utf8");
const controller = readFileSync(
  join(__dirname, "salaries.controller.ts"),
  "utf8",
);

describe("a stray payroll row can be taken off the month", () => {
  it("reaches the route that already existed", () => {
    expect(api).toContain('`/salaries/${id}`, { method: "DELETE" }');
    expect(store).toContain("apiDeleteSalary(row.payrollId)");
    expect(controller).toContain('@RequirePermission("salaries.delete")');
  });

  it("is offered on the payroll page, behind the permission", () => {
    expect(page).toContain('<Can perform="salaries.delete">');
    expect(page).toContain("setRemoveRow(r)");
    expect(page).toContain("removePayroll(removeRow)");
  });

  it("only where no money has been paid", () => {
    // Both halves: the page does not draw the control, and the store refuses
    // even if something else calls it.
    expect(page).toContain("{r.amountPaid === 0 && (");
    expect(store).toMatch(
      /removePayroll[\s\S]{0,400}if \(row\.amountPaid > 0\) \{[\s\S]{0,200}Reverse the payment first/,
    );
  });

  it("asks before it removes anything", () => {
    expect(page).toContain("salaryPayroll.removeRowBody");
    expect(page).toContain('open={!!removeRow}');
  });

  it("leaves a trail", () => {
    expect(store).toContain('"Payroll Row Removed"');
  });
});

describe("the wording exists in every language the school may be reading", () => {
  const DICTS = join(WEB, "lib", "i18n", "dictionaries");
  for (const file of ["generated.ts", "so-generated.ts", "ar-generated.ts"]) {
    it(`${file} carries the new payroll keys`, () => {
      const d = readFileSync(join(DICTS, file), "utf8");
      for (const key of ["removeRow:", "removeRowBody:", "removeRowSafe:"]) {
        expect(d).toContain(`    ${key}`);
      }
    });
  }
});
