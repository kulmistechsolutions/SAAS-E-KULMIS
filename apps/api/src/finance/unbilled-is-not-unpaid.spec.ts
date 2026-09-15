import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A student nobody has billed must never read as "Unpaid".
 *
 * HANUUNIYE's collection desk showed two children as "Unpaid" with "$0.00"
 * outstanding, beside a Pay button that could only refuse — because the fee
 * engine's UNBILLED state was being folded into UNPAID on its way to the page.
 * The desk went looking for a fault in the payment; the fault was that no
 * charge had been raised for the month at all.
 *
 * The engine keeps the two apart. These assertions keep the rest of the system
 * from quietly collapsing them again on the way to a screen.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");

function read(rel: string): string {
  return readFileSync(join(WEB, rel), "utf8");
}

describe("unbilled is not unpaid", () => {
  it("the engine has a state for it", () => {
    const engine = readFileSync(
      join(__dirname, "balance-engine.service.ts"),
      "utf8",
    );
    expect(engine).toContain('"UNBILLED"');
  });

  it("the row state carries it through instead of rewriting it", () => {
    const store = read("lib/fees/store.ts");
    // The old line: `if (p.state === "UNBILLED") return "UNPAID";`
    expect(store).not.toMatch(
      /state === "UNBILLED"\)\s*return "UNPAID"/,
    );
    expect(store).toMatch(/state === "UNBILLED"\)\s*return "UNBILLED"/);
  });

  it("is one of the states a row may hold", () => {
    expect(read("lib/fees/types.ts")).toContain('"UNBILLED"');
  });

  it("the browser fallback agrees with the engine", () => {
    // Scrolling back to an older month uses the fallback; if it still said
    // UNPAID, the contradiction would return the moment somebody changed month.
    expect(read("lib/fees/store.ts")).toContain(
      'if (!charge) return { status: "UNBILLED" };',
    );
  });

  it("never offers to take money against a charge that does not exist", () => {
    const section = read("components/fees/collect-fees-section.tsx");
    expect(section).toContain('const notBilled = r.status === "UNBILLED";');
    expect(section).toContain("!notBilled &&");
  });

  it("can be listed, and is counted on the dashboard", () => {
    expect(read("components/fees/collect-fees-section.tsx")).toContain(
      '<option value="UNBILLED">',
    );
    expect(read("components/fees/summary-cards.tsx")).toContain(
      'key: "unbilledStudents"',
    );
  });
});
