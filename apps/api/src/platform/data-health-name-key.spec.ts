import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The name-matching checks must be able to see a name in any script.
 *
 * `[^a-zA-Z]` strips every Arabic letter, which broke the duplicate checks in
 * both directions at once: three differently named teachers at معهد الرضا all
 * reduced to the empty string and were reported, critically, as one person paid
 * three times — while a genuinely duplicated Arabic name could never be found,
 * because the empty-key guard excluded it. Roughly a third of the schools on
 * this platform name their staff in Arabic.
 *
 * A string test rather than a query, so it holds without a database: the fault
 * was never in the logic, only in which alphabet the logic could read.
 */
describe("data health name keys", () => {
  const source = readFileSync(
    join(__dirname, "data-health.service.ts"),
    "utf8",
  );

  it("never reduces a name with a Latin-only character class", () => {
    // The comment explaining why is allowed to name it; the SQL is not.
    const inSql = source
      .split("\n")
      .filter((line) => !line.trim().startsWith("//"))
      .join("\n");
    expect(inSql).not.toContain("a-zA-Z");
  });

  it("uses a class that covers every script", () => {
    expect(source).toContain("[^[:alnum:]]");
  });

  it("never groups rows whose name reduces to nothing", () => {
    // Without this guard, every name the key cannot read collapses together
    // and the check reports strangers as the same person.
    const guards = source.match(/<> ''/g) ?? [];
    const keys = source.match(/\[\^\[:alnum:\]\]/g) ?? [];
    expect(guards.length).toBeGreaterThan(0);
    expect(keys.length).toBeGreaterThan(0);
  });
});
