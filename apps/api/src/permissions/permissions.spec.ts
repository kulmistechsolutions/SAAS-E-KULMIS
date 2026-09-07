import {
  PERMISSIONS_BY_ROLE,
  UserRole,
  dashboardVisibilityFromGrants,
} from "@ekulmis/shared";
import { mergeGrants, type PermissionGrants } from "./permissions.service";
import { diffGrants } from "./permissions.controller";

/**
 * What a role may do once a school has had its say.
 *
 * The screen that appeared to edit this was writing to the browser's
 * localStorage: a school turning a permission off saw it turn off, on that one
 * machine, until the browser was cleared — and the server never heard about
 * it. These cases pin the merge that replaces it, and above all the two things
 * the PRD names as the faults to avoid: a missing permission must mean deny,
 * and removing a permission must actually remove it.
 */

const FO = UserRole.FINANCE_OFFICER;
const defaults = (role: string): PermissionGrants => ({
  ...(PERMISSIONS_BY_ROLE[role] ?? {}),
});

describe("a school's own permission overrides", () => {
  it("keeps the product default for a module the school never touched", () => {
    const merged = mergeGrants(defaults(FO), { fees: ["view"] });
    expect(merged.salaries).toEqual(PERMISSIONS_BY_ROLE[FO]!.salaries);
    expect(merged.expenses).toEqual(PERMISSIONS_BY_ROLE[FO]!.expenses);
  });

  it("replaces a module the school did set, rather than adding to it", () => {
    // A union would make removing an action impossible — the "fallback
    // access" the PRD calls out by name.
    const merged = mergeGrants(defaults(FO), { fees: ["view"] });
    expect(merged.fees).toEqual(["view"]);
    expect(merged.fees).not.toContain("delete");
  });

  it("treats an empty list as a deliberate revoke, not as silence", () => {
    const merged = mergeGrants(defaults(FO), { fees: [] });
    expect(merged.fees).toEqual([]);
  });

  it("can grant a module the default never gave the role", () => {
    const merged = mergeGrants(defaults(FO), { students: ["view"] });
    expect(merged.students).toEqual(["view"]);
  });

  it("ignores a module or action the product does not have", () => {
    const merged = mergeGrants(
      defaults(FO),
      { spaceships: ["view"], fees: ["view", "teleport"] } as PermissionGrants,
    );
    expect("spaceships" in merged).toBe(false);
    expect(merged.fees).toEqual(["view"]);
  });

  it("returns the plain default when a school has set nothing", () => {
    expect(mergeGrants(defaults(FO), null)).toEqual(defaults(FO));
  });
});

describe("deny by default", () => {
  const has = (g: PermissionGrants, p: string) => {
    const [m, a] = p.split(".");
    return (g[m as keyof PermissionGrants] ?? []).includes(a as never);
  };

  it("says no to a permission nobody listed", () => {
    const g = mergeGrants(defaults(FO), null);
    expect(has(g, "examinations.view")).toBe(false);
    expect(has(g, "students.delete")).toBe(false);
  });

  it("says no once the school has revoked it, though the default allowed it", () => {
    const g = mergeGrants(defaults(FO), { fees: ["view"] });
    expect(has(g, "fees.view")).toBe(true);
    expect(has(g, "fees.update")).toBe(false);
  });

  it("says no for a role the product has never heard of", () => {
    expect(mergeGrants(defaults("WAREHOUSE_MANAGER"), null)).toEqual({});
  });
});

describe("what the audit log records", () => {
  it("names each permission that moved, in both directions", () => {
    const before: PermissionGrants = { fees: ["view", "update"], reports: ["view"] };
    const after: PermissionGrants = { fees: ["view"], reports: ["view", "export"] };
    expect(diffGrants(before, after)).toEqual({
      granted: ["reports.export"],
      revoked: ["fees.update"],
    });
  });

  it("records nothing when a save changed nothing", () => {
    const same: PermissionGrants = { fees: ["view"] };
    expect(diffGrants(same, { ...same })).toEqual({ granted: [], revoked: [] });
  });
});

describe("what the dashboard shows once a school has had its say", () => {
  it("hides the fee cards when the school revokes fees", () => {
    // The dashboard read the product default for the role, so a revoke
    // emptied the menu and the routes while the cards went on showing the
    // money the role no longer held.
    const revoked = mergeGrants(defaults(FO), { fees: [] });
    const v = dashboardVisibilityFromGrants(revoked as Record<string, string[]>);
    expect(v.fees).toBe(false);
    // Finance is a separate grant and is left alone.
    expect(v.finance).toBe(true);
  });

  it("shows them again when the school grants them back", () => {
    const restored = mergeGrants(defaults(FO), null);
    expect(
      dashboardVisibilityFromGrants(restored as Record<string, string[]>).fees,
    ).toBe(true);
  });

  it("shows a card for a module the school added to a role", () => {
    const widened = mergeGrants(defaults(UserRole.ATTENDANCE_OFFICER), {
      students: ["view"],
    });
    const v = dashboardVisibilityFromGrants(widened as Record<string, string[]>);
    expect(v.students).toBe(true);
    expect(v.attendance).toBe(true);
    expect(v.fees).toBe(false);
  });
});

describe("adding a permission a role never had", () => {
  /**
   * The half of the system that did not work at first.
   *
   * Granting `teachers.view` to the Librarian changed nothing: GET /teachers
   * carried a hard-coded role list that rejected the librarian before the
   * permission was ever consulted. A permission you cannot add is not a
   * permission — so where a route declares one, the role list steps aside.
   */
  it("puts the module into the role's effective permissions", () => {
    const before = mergeGrants(defaults(UserRole.LIBRARIAN), null);
    expect(before.teachers).toBeUndefined();

    const after = mergeGrants(defaults(UserRole.LIBRARIAN), {
      teachers: ["view"],
    });
    expect(after.teachers).toEqual(["view"]);
    // And leaves the rest of the role exactly as it was.
    expect(after.library).toEqual(defaults(UserRole.LIBRARIAN).library);
  });

  it("adds one action without granting the others", () => {
    const after = mergeGrants(defaults(UserRole.LIBRARIAN), {
      teachers: ["view"],
    });
    const has = (p: string) => {
      const [m, a] = p.split(".");
      return (after[m as keyof PermissionGrants] ?? []).includes(a as never);
    };
    expect(has("teachers.view")).toBe(true);
    expect(has("teachers.create")).toBe(false);
    expect(has("teachers.delete")).toBe(false);
  });
});

describe("a role a school made for itself", () => {
  /**
   * Custom roles were an Add Role button that wrote to the browser: the role
   * existed on one machine, could not be given to anybody, and vanished when
   * that browser cleared its data.
   *
   * They now live in the school's own data, and their permissions sit in the
   * same table as an override of a built-in role — so every guard reads one
   * place whichever kind of role somebody is on.
   */
  it("starts holding nothing at all", () => {
    // Deny by default matters most here: a new role that arrived holding
    // something nobody chose is the grant this whole change exists to stop.
    expect(mergeGrants(defaults("some-custom-role-id"), null)).toEqual({});
  });

  it("holds exactly what the school gave it", () => {
    const granted = mergeGrants(defaults("some-custom-role-id"), {
      library: ["view", "create"],
      students: ["view"],
    });
    expect(granted).toEqual({
      library: ["view", "create"],
      students: ["view"],
    });
  });

  it("is read under its own id, not the built-in role behind it", () => {
    // The account keeps its built-in role so portal routing and the legacy
    // @Roles lists still work, and so deleting a custom role leaves people
    // able to sign in — but "may they" is answered by the custom role.
    const builtIn = mergeGrants(defaults(UserRole.LIBRARIAN), null);
    const custom = mergeGrants(defaults("some-custom-role-id"), {
      fees: ["view"],
    });
    expect(builtIn.library).toBeDefined();
    expect(custom.library).toBeUndefined();
    expect(custom.fees).toEqual(["view"]);
  });
});
