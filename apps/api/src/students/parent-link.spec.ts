import { decideParentChange, type ParentChangeFacts } from "./parent-link";

const facts = (over: Partial<ParentChangeFacts> = {}): ParentChangeFacts => ({
  holderId: null,
  currentParentId: "parent-A",
  siblingCount: 0,
  nameChanged: false,
  phoneChanged: false,
  ...over,
});

describe("decideParentChange", () => {
  it("does nothing when the details were not touched", () => {
    expect(decideParentChange(facts())).toEqual({ kind: "none" });
  });

  it("does nothing when the details were retyped identically", () => {
    expect(
      decideParentChange(facts({ holderId: "parent-A", siblingCount: 3 })),
    ).toEqual({ kind: "none" });
  });

  describe("fixing the family's own details", () => {
    it("renames in place for an only child", () => {
      expect(
        decideParentChange(facts({ siblingCount: 0, nameChanged: true })),
      ).toEqual({ kind: "rename" });
    });

    it("renames in place when only the name was mistyped", () => {
      // The phone is unchanged, so the current parent still holds it.
      expect(
        decideParentChange(
          facts({ holderId: "parent-A", siblingCount: 2, nameChanged: true }),
        ),
      ).toEqual({ kind: "rename" });
    });

    it("takes a new phone for an only child rather than splitting them off", () => {
      expect(
        decideParentChange(facts({ siblingCount: 0, phoneChanged: true })),
      ).toEqual({ kind: "rename" });
    });
  });

  describe("a child filed under the wrong family", () => {
    // The reported case: a parent responsible for one child had a second
    // child wrongly added. Correcting that child must not touch the parent
    // record, because the child who does belong there reads the same row.
    it("moves the child to the parent already holding the typed phone", () => {
      expect(
        decideParentChange(
          facts({
            holderId: "parent-B",
            siblingCount: 1,
            nameChanged: true,
            phoneChanged: true,
          }),
        ),
      ).toEqual({ kind: "attach", parentId: "parent-B" });
    });

    it("moves even when the school retyped the name to match", () => {
      expect(
        decideParentChange(
          facts({ holderId: "parent-B", siblingCount: 1, phoneChanged: true }),
        ),
      ).toEqual({ kind: "attach", parentId: "parent-B" });
    });

    it("creates a parent when the right one is not in the system yet", () => {
      expect(
        decideParentChange(
          facts({
            holderId: null,
            siblingCount: 1,
            nameChanged: true,
            phoneChanged: true,
          }),
        ),
      ).toEqual({ kind: "create" });
    });

    it("never renames a parent who has other children", () => {
      for (const over of [
        { nameChanged: true },
        { phoneChanged: true },
        { nameChanged: true, phoneChanged: true },
      ]) {
        const decision = decideParentChange(
          facts({ holderId: null, siblingCount: 2, ...over }),
        );
        expect(decision.kind).toBe("create");
      }
    });
  });
});
