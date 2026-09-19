import {
  daysInMonth,
  isWithinBackfill,
  markingDecision,
  normaliseWindow,
  validateWindow,
  type BackfillWindow,
  type MarkingContext,
} from "./backfill-window";

const OPEN: BackfillWindow = {
  open: true,
  from: "2026-08-01",
  to: "2026-08-31",
};

function ctx(over: Partial<MarkingContext> = {}): MarkingContext {
  return {
    date: "2026-09-17",
    today: "2026-09-17",
    nowMinutes: 9 * 60,
    lockMinutes: 16 * 60,
    role: "ATTENDANCE_OFFICER",
    backfill: null,
    excusedEnabled: true,
    statuses: ["PRESENT"],
    ...over,
  };
}

describe("reading a window out of settings", () => {
  it("reads a well-formed one", () => {
    expect(normaliseWindow({ open: true, from: "2026-08-01", to: "2026-08-31" }))
      .toMatchObject({ open: true, from: "2026-08-01", to: "2026-08-31" });
  });

  it("refuses anything it cannot read as a window", () => {
    // Settings are JSON. A half-written window must be no window at all —
    // never a window over every date there has ever been.
    for (const bad of [
      null,
      undefined,
      "2026-08",
      {},
      { open: true },
      { open: true, from: "2026-08-01" },
      { open: true, from: "August", to: "2026-08-31" },
      { open: true, from: "2026-13-01", to: "2026-13-31" },
      { open: true, from: "2026-08-31", to: "2026-08-01" },
    ]) {
      expect(normaliseWindow(bad)).toBeNull();
    }
  });

  it("treats a window that was closed as closed", () => {
    const w = normaliseWindow({
      open: false,
      from: "2026-08-01",
      to: "2026-08-31",
    });
    expect(w).not.toBeNull();
    expect(isWithinBackfill(w, "2026-08-12")).toBe(false);
  });
});

describe("which days a window covers", () => {
  it("covers both ends", () => {
    expect(isWithinBackfill(OPEN, "2026-08-01")).toBe(true);
    expect(isWithinBackfill(OPEN, "2026-08-31")).toBe(true);
  });

  it("covers nothing outside itself", () => {
    expect(isWithinBackfill(OPEN, "2026-07-31")).toBe(false);
    expect(isWithinBackfill(OPEN, "2026-09-01")).toBe(false);
  });

  it("covers nothing at all when there is no window", () => {
    expect(isWithinBackfill(null, "2026-08-12")).toBe(false);
  });
});

describe("a day that has not happened", () => {
  it("is refused, whoever is asking", () => {
    for (const role of [
      "TEACHER",
      "ATTENDANCE_OFFICER",
      "ADMINISTRATOR",
      "SUPER_ADMINISTRATOR",
    ]) {
      const d = markingDecision(ctx({ date: "2026-09-19", role }));
      expect(d.allowed).toBe(false);
    }
  });

  it("allows one day of slack for a school whose clock is wrong", () => {
    // Seventy-one schools are recorded as UTC while sitting three hours ahead
    // of it, so between midnight and 3am their real date is the server's
    // tomorrow. Refusing that would strand an early-morning register on a
    // setting nobody at the school knows about.
    expect(markingDecision(ctx({ date: "2026-09-18" })).allowed).toBe(true);
  });

  it("still refuses a mistyped year", () => {
    expect(markingDecision(ctx({ date: "2027-09-17" })).allowed).toBe(false);
    expect(markingDecision(ctx({ date: "2036-09-17" })).allowed).toBe(false);
  });

  it("counts the slack across a month end", () => {
    expect(
      markingDecision(ctx({ date: "2026-10-01", today: "2026-09-30" })).allowed,
    ).toBe(true);
    expect(
      markingDecision(ctx({ date: "2026-10-02", today: "2026-09-30" })).allowed,
    ).toBe(false);
  });

  it("is refused even inside a catch-up window", () => {
    // A window is for months already taught, not for marking ahead.
    const d = markingDecision(
      ctx({
        date: "2027-08-15",
        backfill: { open: true, from: "2026-08-01", to: "2027-12-31" },
      }),
    );
    expect(d.allowed).toBe(false);
  });

  it("says so in words a school can act on", () => {
    const d = markingDecision(ctx({ date: "2026-10-30" }));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("has not happened yet");
  });
});

describe("catch-up marking", () => {
  it("lets the people who take the register enter a past month", () => {
    for (const role of ["TEACHER", "ATTENDANCE_OFFICER"]) {
      expect(
        markingDecision(ctx({ date: "2026-08-12", role, backfill: OPEN }))
          .allowed,
      ).toBe(true);
    }
  });

  it("does nothing for a day outside the window", () => {
    const d = markingDecision(ctx({ date: "2026-07-12", backfill: OPEN }));
    expect(d.allowed).toBe(false);
  });

  it("does nothing once the window is closed", () => {
    const d = markingDecision(
      ctx({ date: "2026-08-12", backfill: { ...OPEN, open: false } }),
    );
    expect(d.allowed).toBe(false);
  });

  it("points at where the window is opened when it refuses", () => {
    const d = markingDecision(ctx({ date: "2026-08-12" }));
    expect(d.allowed).toBe(false);
    if (!d.allowed) expect(d.reason).toContain("Settings");
  });

  it("does not switch off the school's other rules", () => {
    // Excused is off; a window over August is not permission to use it.
    const d = markingDecision(
      ctx({
        date: "2026-08-12",
        backfill: OPEN,
        excusedEnabled: false,
        statuses: ["PRESENT", "EXCUSED"],
      }),
    );
    expect(d.allowed).toBe(false);
  });
});

describe("the ordinary rules, unchanged", () => {
  it("lets today be marked before the lock", () => {
    expect(markingDecision(ctx({ nowMinutes: 15 * 60 })).allowed).toBe(true);
  });

  it("closes today at the lock", () => {
    expect(markingDecision(ctx({ nowMinutes: 16 * 60 })).allowed).toBe(false);
  });

  it("leaves an administrator the valve to correct a past day", () => {
    expect(
      markingDecision(ctx({ date: "2026-08-12", role: "ADMINISTRATOR" }))
        .allowed,
    ).toBe(true);
    expect(
      markingDecision(ctx({ date: "2026-08-12", role: "SUPER_ADMINISTRATOR" }))
        .allowed,
    ).toBe(true);
  });

  it("enforces nothing when the school set no lock", () => {
    expect(
      markingDecision(ctx({ date: "2026-08-12", lockMinutes: null })).allowed,
    ).toBe(true);
  });
});

describe("opening a window", () => {
  const YEAR = { start: "2026-08-01", end: "2027-06-30" };

  it("accepts a past month inside the academic year", () => {
    expect(validateWindow("2026-08-01", "2026-08-31", "2026-09-17", YEAR))
      .toBeNull();
  });

  it("refuses a window that reaches into the future", () => {
    expect(validateWindow("2026-08-01", "2026-10-31", "2026-09-17", YEAR))
      .toContain("future");
  });

  it("refuses a window outside the academic year", () => {
    expect(validateWindow("2025-08-01", "2026-08-31", "2026-09-17", YEAR))
      .toContain("academic year");
  });

  it("is checked against today alone when the year has no usable dates", () => {
    // Six schools have an active year ending on or before the day it starts —
    // KTS runs "2026/2027" from 2026-08-01 to 2026-06-20. Passing that through
    // as a bound would refuse every month there is, so the caller passes null
    // and only the future check applies.
    expect(validateWindow("2026-08-01", "2026-08-31", "2026-09-17", null))
      .toBeNull();
    expect(validateWindow("2026-08-01", "2026-12-31", "2026-09-17", null))
      .toContain("future");
  });

  it("refuses a backwards window and a malformed one", () => {
    expect(validateWindow("2026-08-31", "2026-08-01", "2026-09-17", null))
      .not.toBeNull();
    expect(validateWindow("August", "2026-08-31", "2026-09-17", null))
      .not.toBeNull();
  });
});

describe("listing a month", () => {
  it("knows how long each month is", () => {
    expect(daysInMonth(2026, 2)).toHaveLength(28);
    expect(daysInMonth(2028, 2)).toHaveLength(29);
    expect(daysInMonth(2026, 8)).toHaveLength(31);
    expect(daysInMonth(2026, 9)).toHaveLength(30);
  });

  it("writes every day as a full date", () => {
    const d = daysInMonth(2026, 8);
    expect(d[0]).toBe("2026-08-01");
    expect(d[30]).toBe("2026-08-31");
  });
});
