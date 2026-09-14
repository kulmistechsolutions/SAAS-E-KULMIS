import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";

/**
 * No table may be wider than the phone it is read on with no way to scroll it.
 *
 * Fifty tables across the app sat directly inside `overflow-hidden` wrappers.
 * On a phone that does not squeeze the columns — it *clips* them: the last
 * three columns of a fee ledger, a payroll or a mark sheet simply were not
 * reachable, with nothing on screen to say anything had been cut off. Schools
 * reported it as "the page is not responsive"; it was worse than that.
 *
 * This guard lives in the API's suite because it is the only test runner in
 * the repo. It reads the web source and nothing else — no rendering, no
 * imports across the package boundary.
 */
const WEB_SRC = join(__dirname, "..", "..", "..", "web", "src");
const SCROLLS = /overflow-x-auto|overflow-auto|overflow-x-scroll/;

function tsxFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...tsxFiles(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

describe("every table can be scrolled sideways", () => {
  const files = tsxFiles(WEB_SRC);

  it("finds the web source", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("has no table without a scrolling ancestor near it", () => {
    const offenders: string[] = [];

    for (const file of files) {
      const src = readFileSync(file, "utf8");
      for (const m of src.matchAll(/<table\b/g)) {
        const at = m.index ?? 0;
        // The wrapper is always within a few hundred characters above the
        // tag; anything further away is a different element's business.
        const above = src.slice(Math.max(0, at - 400), at);
        if (!SCROLLS.test(above)) {
          const line = src.slice(0, at).split("\n").length;
          offenders.push(`${relative(WEB_SRC, file).replace(/\\/g, "/")}:${line}`);
        }
      }
    }

    expect(offenders).toEqual([]);
  });
});
