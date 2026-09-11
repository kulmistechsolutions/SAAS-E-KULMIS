import {
  DEFAULT_TIME_ZONE,
  isValidTimeZone,
  safeTimeZone,
} from "./time-zone.util";

/**
 * The five values below are not invented. They are what five live schools
 * actually had in the time-zone field on 11 September 2026, and each one was
 * turning attendance into a 500 for that school.
 */
const REAL_BAD_VALUES = [
  "hodon", // a district name (NUURUL-YAQIIN)
  "24", // (SHAMSUL-MA'ARIF)
  "SOMALIA -KGS", // (Khatam Al-Mursaleen)
  "7:30AM-12:10PM", // the school day (BARWAAQO)
  "UTC+3", // meant well, still not an IANA zone (QALINSAME)
];

describe("isValidTimeZone", () => {
  it("accepts a real zone", () => {
    expect(isValidTimeZone("Africa/Mogadishu")).toBe(true);
    expect(isValidTimeZone("UTC")).toBe(true);
    expect(isValidTimeZone("Europe/London")).toBe(true);
  });

  it("rejects every value that was actually crashing a school", () => {
    for (const bad of REAL_BAD_VALUES) {
      expect(isValidTimeZone(bad)).toBe(false);
    }
  });

  it("rejects nothing at all", () => {
    expect(isValidTimeZone("")).toBe(false);
    expect(isValidTimeZone("   ")).toBe(false);
    expect(isValidTimeZone(null)).toBe(false);
    expect(isValidTimeZone(undefined)).toBe(false);
  });
});

describe("safeTimeZone", () => {
  it("keeps a zone that works", () => {
    expect(safeTimeZone("Africa/Mogadishu")).toBe("Africa/Mogadishu");
  });

  it("falls back instead of throwing on every broken value", () => {
    for (const bad of REAL_BAD_VALUES) {
      expect(safeTimeZone(bad)).toBe(DEFAULT_TIME_ZONE);
    }
  });

  it("falls back to what an unconfigured school already uses", () => {
    // 70 of the 78 schools carry UTC because that is the column default.
    // A broken value should be treated the same as an unset one, not given a
    // different clock from every other school on the platform.
    expect(DEFAULT_TIME_ZONE).toBe("UTC");
    expect(safeTimeZone(null)).toBe("UTC");
  });

  it("produces something Intl will actually accept", () => {
    // The point of the whole file: whatever comes out can be formatted with.
    for (const bad of [...REAL_BAD_VALUES, null, undefined, ""]) {
      expect(() =>
        new Intl.DateTimeFormat("en-US", {
          timeZone: safeTimeZone(bad),
        }).format(new Date()),
      ).not.toThrow();
    }
  });
});
