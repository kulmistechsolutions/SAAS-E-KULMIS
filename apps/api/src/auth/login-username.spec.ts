import { AuthService } from "./auth.service";

/**
 * A username typed with a stray space or in the wrong case still signs in.
 *
 * In one week 29 sign-ins for accounts that exist were refused as "unknown
 * user" for nothing more than that: "TCH0013 " at alihsanpiss (a phone
 * keyboard's trailing space), "tch0018", "ALPHA ".
 */
type U = { id: string; schoolId: string; username: string };

function service(users: U[]) {
  const prisma = {
    user: {
      findUnique: async ({ where }: { where: { schoolId_username: { schoolId: string; username: string } } }) =>
        users.find(
          (u) =>
            u.schoolId === where.schoolId_username.schoolId &&
            u.username === where.schoolId_username.username,
        ) ?? null,
      findMany: async ({ where, take }: { where: { schoolId: string; username: { equals: string } }; take: number }) =>
        users
          .filter(
            (u) =>
              u.schoolId === where.schoolId &&
              u.username.toLowerCase() === where.username.equals.toLowerCase(),
          )
          .slice(0, take),
    },
  };
  const svc = new AuthService(prisma as never, {} as never, {} as never, {} as never, {} as never, {} as never);
  return (s: string, name: string) =>
    (svc as unknown as { findLoginUser: (s: string, n: string) => Promise<U | null> }).findLoginUser(s, name);
}

const users: U[] = [
  { id: "t13", schoolId: "a", username: "TCH0013" },
  { id: "x1", schoolId: "a", username: "xaawo1" },
  { id: "other", schoolId: "b", username: "TCH0013" },
  // Two accounts differing only in case: neither may be guessed.
  { id: "c1", schoolId: "a", username: "Ali" },
  { id: "c2", schoolId: "a", username: "ALI" },
];

describe("finding the account a typed username means", () => {
  const find = service(users);

  it("takes an exact match first", async () => {
    expect((await find("a", "TCH0013"))?.id).toBe("t13");
    expect((await find("a", "ALI"))?.id).toBe("c2");
  });

  it("ignores a trailing or leading space", async () => {
    expect((await find("a", "TCH0013 "))?.id).toBe("t13");
    expect((await find("a", " TCH0013"))?.id).toBe("t13");
  });

  it("ignores case", async () => {
    expect((await find("a", "tch0013"))?.id).toBe("t13");
    expect((await find("a", "XAAWO1 "))?.id).toBe("x1");
  });

  it("never reaches into another school", async () => {
    expect((await find("b", "tch0013"))?.id).toBe("other");
    expect(await find("c", "TCH0013")).toBeNull();
  });

  it("refuses to guess between two accounts that differ only in case", async () => {
    expect(await find("a", "ali")).toBeNull();
  });

  it("does not turn a different username into a match", async () => {
    // The letter O for a zero is a different username; it stays refused.
    expect(await find("a", "TCHOO13")).toBeNull();
    expect(await find("a", "   ")).toBeNull();
  });
});
