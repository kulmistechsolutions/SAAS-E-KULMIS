import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * A school with a lapsed plan can pay for a new one — and can do nothing else.
 *
 * Until now an expired subscription ended sign-in with "please contact
 * Platform Administrator". The screen that sells a plan sits behind sign-in,
 * so the one action that would fix the situation was the one action the school
 * could not take, and every renewal became a phone call to somebody who might
 * be asleep.
 *
 * The fix hands an administrator a token instead of a refusal. The whole
 * safety of that rests on one property: the token opens the billing routes and
 * is refused everywhere else, by default, so a route written next year that
 * never considered this case cannot quietly accept it.
 */
const HERE = __dirname;
const guard = readFileSync(join(HERE, "jwt-auth.guard.ts"), "utf8");
const service = readFileSync(join(HERE, "auth.service.ts"), "utf8");
const types = readFileSync(join(HERE, "auth.types.ts"), "utf8");
const subsController = readFileSync(
  join(HERE, "..", "subscriptions", "subscriptions.controller.ts"),
  "utf8",
);

describe("the renewal token is refused by default", () => {
  it("is checked in the guard every authenticated request passes through", () => {
    expect(guard).toContain('if (payload.scope === "BILLING")');
    expect(guard).toContain("BILLING_SCOPE_KEY");
  });

  it("refuses unless the route opted in", () => {
    // Deny by default. An allowlist that has to be added to is a decision; a
    // denylist that has to be maintained is an accident waiting to happen.
    expect(guard).toMatch(/if \(!allowed\) \{[\s\S]{0,200}ForbiddenException/);
  });

  it("decides before the caller is attached to the request", () => {
    // A handler must never see req.user for a billing token it did not ask
    // for — not even to ignore it.
    const idx = guard.indexOf('payload.scope === "BILLING"');
    expect(idx).toBeGreaterThan(-1);
    expect(idx).toBeLessThan(guard.indexOf("req.user = {"));
  });

  it("carries the scope onto the request so a handler can see it", () => {
    expect(guard).toContain("scope: payload.scope,");
    expect(types).toContain('scope?: "BILLING";');
  });
});

describe("what the token may reach", () => {
  const opened = subsController.match(/@BillingScope\(\)/g) ?? [];

  it("is a short, deliberate list", () => {
    // Four: where the school stands, the plans, paying, and checking a
    // payment — plus the receipt for it. If this number grows, somebody
    // should have to explain why.
    expect(opened.length).toBeGreaterThan(0);
    expect(opened.length).toBeLessThanOrEqual(6);
  });

  it("covers exactly the renewal journey", () => {
    // Only the school-facing half: the platform console has routes of the
    // same name, and they are nobody's business here.
    const schoolSide = subsController.slice(
      subsController.indexOf("Reachable with a renewal-only token"),
    );
    for (const route of [
      '@Get("me")',
      '@Get("plans")',
      '@Post("purchase")',
      '@Post("payments/:id/verify")',
    ]) {
      const at = schoolSide.indexOf(route);
      expect(at).toBeGreaterThan(-1);
      // The decorator sits within the few lines above the route.
      expect(schoolSide.slice(Math.max(0, at - 220), at)).toContain(
        "@BillingScope()",
      );
    }
  });

  it("is not granted anywhere outside subscriptions", () => {
    // Every other controller in the API. A billing token reaching students,
    // finance or settings would be the whole failure.
    const { execSync } = require("node:child_process") as typeof import("node:child_process");
    // The import, not the word: the decorator's own file and the comments
    // that explain it both mention it by name, and neither grants anything.
    const hits = execSync(
      'git grep -l "auth/billing-scope.decorator" -- "apps/api/src" || true',
      { cwd: join(HERE, "..", "..", "..", ".."), encoding: "utf8" },
    )
      .split("\n")
      .filter(Boolean)
      .filter((f) => !f.includes("billing-scope.decorator"))
      .filter((f) => !f.includes(".spec."));
    expect(hits).toEqual(["apps/api/src/subscriptions/subscriptions.controller.ts"]);
  });
});

describe("who is offered a renewal at all", () => {
  it("only an administrator, because only they can buy", () => {
    expect(service).toContain(
      'user.role === "ADMINISTRATOR" || user.role === "SUPER_ADMINISTRATOR"',
    );
  });

  it("everybody else is still refused, with something they can act on", () => {
    expect(service).toContain("Ask your school administrator to renew it.");
  });

  it("is decided after the password, never before", () => {
    // A wrong password must not reveal a school's billing state.
    const login = service.slice(service.indexOf("async login("));
    expect(login.indexOf("verifyPassword(")).toBeLessThan(
      login.indexOf("schoolAccess(schoolId)"),
    );
  });

  it("is written to the audit trail either way", () => {
    expect(service).toContain('action: canRenew ? "Renewal Session Issued" : LOGIN_FAILED');
  });
});

describe("the token itself", () => {
  it("is short-lived", () => {
    expect(service).toContain("expiresIn: 30 * 60");
  });

  it("comes with no refresh token", () => {
    // Renewing the right to spend without signing in again is not something
    // to offer. The returned object has no refreshToken at all.
    const issue = service.slice(
      service.indexOf("return {\n        renewal: true as const,"),
      service.indexOf("async login(") + 4000,
    );
    expect(issue).not.toContain("refreshToken");
  });
});
