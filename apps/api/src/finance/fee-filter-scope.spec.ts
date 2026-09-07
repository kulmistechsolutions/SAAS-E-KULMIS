import { narrowFilterToScope } from "./fees.controller";

/**
 * A filter chosen on screen narrows a question. It must never widen one.
 *
 * The fee dashboard now asks the server for one class rather than filtering
 * cards in the browser, which is the only way a total and the list behind it
 * can be the same arithmetic. That makes the filter a parameter a user
 * supplies, and a supplied parameter that reaches past what its sender covers
 * is not a display bug — it is one clerk reading another's classes.
 */
describe("holding a fee filter inside a scope", () => {
  it("gives someone who covers the school whatever they asked for", () => {
    expect(narrowFilterToScope(null, "c8", "sA")).toEqual({
      classId: "c8",
      sectionId: "sA",
    });
    expect(narrowFilterToScope(null)).toEqual({
      classId: undefined,
      sectionId: undefined,
    });
  });

  it("gives a scoped person the class they asked for when it is theirs", () => {
    expect(narrowFilterToScope(["c8", "c9"], "c8")).toEqual({
      classId: "c8",
      sectionId: undefined,
    });
  });

  it("gives nothing — not everything — for a class they do not cover", () => {
    // `{}` here would answer with the whole school, which is the inversion
    // this function exists to prevent.
    expect(narrowFilterToScope(["c8"], "c9")).toEqual({ classIds: [] });
  });

  it("falls back to their own classes, not the school's", () => {
    // /fees/position used to answer with the school for anyone holding
    // fees.view, whatever classes they were scoped to.
    expect(narrowFilterToScope(["c8", "c9"])).toEqual({
      classIds: ["c8", "c9"],
      sectionId: undefined,
    });
  });

  it("leaves someone scoped to no classes seeing no money", () => {
    expect(narrowFilterToScope([])).toEqual({
      classIds: [],
      sectionId: undefined,
    });
    expect(narrowFilterToScope([], "c8")).toEqual({ classIds: [] });
  });

  it("keeps a section narrowing alongside the class one", () => {
    expect(narrowFilterToScope(["c8"], "c8", "sB")).toEqual({
      classId: "c8",
      sectionId: "sB",
    });
  });
});
