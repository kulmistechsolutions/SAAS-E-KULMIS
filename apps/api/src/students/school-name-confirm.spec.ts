import { nameMatches } from "./school-reset.service";

/**
 * The gate in front of every irreversible action a school can take.
 *
 * Eight schools store a trailing space in their name — "DUGSIGA HANTI-WADAAG "
 * — and HTML collapses it, so the prompt showed a name an administrator could
 * copy character for character and never match. The button stayed grey with
 * nothing to explain why, and every Danger Zone action was unreachable for
 * those schools: reset fees, reset teachers, reset a class, reset the school.
 *
 * The confirmation exists to prove somebody knows which school they are about
 * to erase. A character nobody can see is no part of that proof. Everything
 * visible still is, which is the other half of these tests — trimming must not
 * become "close enough".
 */
describe("confirming which school is about to be erased", () => {
  it("accepts the name as it appears on screen", () => {
    expect(nameMatches("DUGSIGA HANTI-WADAAG", "DUGSIGA HANTI-WADAAG")).toBe(true);
  });

  it("accepts it when the stored name carries an invisible trailing space", () => {
    // The live case. Length 21 stored, 20 visible.
    expect(nameMatches("DUGSIGA HANTI-WADAAG", "DUGSIGA HANTI-WADAAG ")).toBe(true);
  });

  it("accepts it when the stored name is padded in front", () => {
    // NAGAYLE's is stored this way round.
    expect(
      nameMatches(
        "NAGAYLE PRIMARY AND SECONDARY SCHOOL",
        " NAGAYLE PRIMARY AND SECONDARY SCHOOL",
      ),
    ).toBe(true);
  });

  it("forgives the typist the same whitespace it forgives the record", () => {
    expect(nameMatches("  GALLAYR SCHOOL  ", "GALLAYR SCHOOL ")).toBe(true);
  });

  it("still refuses a different school", () => {
    expect(nameMatches("GALLAYR SCHOOL", "SINAAN SCHOOL")).toBe(false);
  });

  it("still refuses the wrong case", () => {
    // Visible, so it stays part of the proof.
    expect(nameMatches("gallayr school", "GALLAYR SCHOOL ")).toBe(false);
  });

  it("still refuses a near miss", () => {
    expect(nameMatches("DUGSIGA HANTI WADAAG", "DUGSIGA HANTI-WADAAG ")).toBe(false);
    expect(nameMatches("DUGSIGA HANTI-WADAA", "DUGSIGA HANTI-WADAAG ")).toBe(false);
  });

  it("refuses an empty confirmation, whatever the record holds", () => {
    // The one that matters most: a blank box must never satisfy the gate for a
    // school whose stored name is nothing but spaces.
    expect(nameMatches("", "DUGSIGA HANTI-WADAAG ")).toBe(false);
    expect(nameMatches("   ", "DUGSIGA HANTI-WADAAG ")).toBe(false);
  });
});
