import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Signing in to a school on its behalf is the most dangerous button in the
 * product, so what makes it safe is pinned here rather than left to whoever
 * edits it next.
 *
 * The alternative it replaces was worse: asking a school for its password.
 * That teaches schools that handing their password to someone claiming to be
 * support is normal, and leaves the platform owner holding a credential they
 * can never give back. It also left a school locked out by an expired plan
 * impossible to help at all.
 */
const HERE = __dirname;
const service = readFileSync(join(HERE, "school-sign-in.service.ts"), "utf8");
const controller = readFileSync(join(HERE, "schools.controller.ts"), "utf8");
const dialog = readFileSync(
  join(HERE, "..", "..", "..", "web", "src", "components", "platform", "school-sign-in-dialog.tsx"),
  "utf8",
);

describe("only the platform owner, and only with a reason", () => {
  it("sits behind the platform guard", () => {
    expect(controller).toContain("@UseGuards(PlatformGuard)");
    expect(controller).toContain('@Post(":id/sign-in")');
  });

  it("refuses without a reason worth reading", () => {
    expect(service).toContain("if (trimmed.length < 5)");
    expect(controller).toContain("z.string().min(5).max(300)");
  });

  it("will not let the dialog send an empty one either", () => {
    expect(dialog).toContain("reason.trim().length < 5");
  });
});

describe("the school can see it happened", () => {
  it("writes to the school's own audit trail, not only the platform's", () => {
    // The one that matters. Support a customer cannot see is surveillance.
    expect(service).toContain('action: "Platform Support Sign-In"');
    expect(service).toContain("await this.audit.record({");
    expect(service).toContain("platformAdmin: admin.username");
    expect(service).toContain("reason: trimmed");
  });

  it("writes the school's copy first", () => {
    // If the platform's own copy fails, the school still has the record.
    expect(service.indexOf("this.audit.record(")).toBeLessThan(
      service.indexOf("platformAuditLog"),
    );
  });

  it("records it on the platform side too, against that school", () => {
    expect(service).toContain('action: "SCHOOL_SIGN_IN"');
    expect(service).toContain("schoolId,");
  });
});

describe("the session is small and ends by itself", () => {
  it("lasts thirty minutes", () => {
    expect(service).toContain("const MINUTES = 30;");
    expect(service).toContain("expiresIn: MINUTES * 60");
  });

  it("cannot be refreshed", () => {
    // Renewing it would mean renewing the right without asking again.
    expect(service).not.toContain("refreshToken");
  });

  it("is marked, so a screen can say so and a rule can refuse it", () => {
    expect(service).toContain("imp: admin.username");
  });

  it("carries the school administrator's rights and no more", () => {
    // Not a super-token: the same role, the same custom role, the same
    // permissions that person already had.
    expect(service).toContain('role: { in: ["SUPER_ADMINISTRATOR", "ADMINISTRATOR"] }');
    expect(service).toContain("role: user.role,");
    expect(service).toContain("user.customRoleId ? { crid: user.customRoleId }");
  });

  it("refuses a school with nobody to sign in as", () => {
    expect(service).toContain("has no active administrator account to sign in as");
  });
});

describe("the token does not travel where it can be logged", () => {
  it("is handed over in the URL fragment", () => {
    // Fragments are never sent to a server, so it cannot land in an access
    // log or a referrer header on the way in.
    expect(dialog).toContain("/support-session#token=");
  });

  it("is taken out of the address bar on arrival", () => {
    const landing = readFileSync(
      join(HERE, "..", "..", "..", "web", "src", "app", "support-session", "page.tsx"),
      "utf8",
    );
    expect(landing).toContain("window.history.replaceState");
    expect(landing).toContain("setRefreshToken(null)");
  });
});
