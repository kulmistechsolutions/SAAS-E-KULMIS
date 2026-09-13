import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A student's portal password hash must never leave the server.
 *
 * The student list and the student page were built with Prisma's `include`,
 * which returns every scalar column on the model — so `portalPasswordHash`,
 * the scrypt hash of the child's own portal password, was in the response to
 * anyone who could open a class list, and in every browser cache and network
 * log along the way.
 *
 * These assertions are deliberately about the shape of the code rather than a
 * live response: the strip has to survive somebody adding a new return path,
 * and the type is what stops a fourth one from being written.
 */
describe("student responses carry no secrets", () => {
  const source = readFileSync(
    join(__dirname, "students.service.ts"),
    "utf8",
  );

  it("omits the portal hash from the type the API returns", () => {
    expect(source).toContain(
      'export type StudentWithPhoto = Omit<StudentRow, "portalPasswordHash">',
    );
  });

  it("strips the hash rather than trusting the type alone", () => {
    expect(source).toContain("function withoutSecrets(");
    expect(source).toContain("const { portalPasswordHash: _secret, ...rest }");
  });

  it("passes every returned row through the strip", () => {
    // Each place a student row becomes a response.
    const spreads = source.match(/\.\.\.(student|s)\b(?=,?\s*\n?\s*hasPhoto)/g);
    expect(spreads).toBeNull();
  });

  it("never selects the hash outside the portal login check", () => {
    const lines = source.split("\n");
    const offenders = lines.filter(
      (l) =>
        l.includes("portalPasswordHash") &&
        // Prose about the hole is not the hole.
        !/^\s*(\*|\/\/)/.test(l) &&
        !l.includes("Omit<StudentRow") &&
        !l.includes("_secret") &&
        // Writing one is fine; it is reading one back out that leaks.
        !/portalPasswordHash(,|\s*=|\s*\})/.test(l),
    );
    expect(offenders).toEqual([]);
  });
});
