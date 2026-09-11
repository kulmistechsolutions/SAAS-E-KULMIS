import {
  BALANCE_STALE_AFTER_HOURS,
  parseProviderBalance,
  smsBalanceHealth,
} from "./sms-balance-health";

const now = new Date("2026-09-11T12:00:00Z");
const justNow = new Date("2026-09-11T11:30:00Z");

describe("smsBalanceHealth", () => {
  it("reports the surplus when the provider covers what schools hold", () => {
    const h = smsBalanceHealth({
      providerBalance: 50_000,
      creditsOutstanding: 8_000,
      checkedAt: justNow,
      now,
    });
    expect(h.drift).toBe(42_000);
    expect(h.oversold).toBe(false);
    expect(h.unknown).toBe(false);
    expect(h.stale).toBe(false);
  });

  it("flags oversold when schools hold more than the provider can cover", () => {
    // Nothing fails on the day this becomes true — every message still goes
    // out. It fails on the day the provider account empties, and then for
    // every school at once.
    const h = smsBalanceHealth({
      providerBalance: 8_000,
      creditsOutstanding: 50_000,
      checkedAt: justNow,
      now,
    });
    expect(h.drift).toBe(-42_000);
    expect(h.oversold).toBe(true);
  });

  it("does not call an exact match oversold", () => {
    const h = smsBalanceHealth({
      providerBalance: 8_000,
      creditsOutstanding: 8_000,
      checkedAt: justNow,
      now,
    });
    expect(h.drift).toBe(0);
    expect(h.oversold).toBe(false);
  });

  it("says unknown rather than healthy when nothing has been read", () => {
    // The dangerous answer here would be "fine".
    const h = smsBalanceHealth({
      providerBalance: null,
      creditsOutstanding: 50_000,
      checkedAt: null,
      now,
    });
    expect(h.unknown).toBe(true);
    expect(h.oversold).toBe(false);
    expect(h.drift).toBeNull();
  });

  it("says unknown when a figure exists but was never timed", () => {
    const h = smsBalanceHealth({
      providerBalance: 8_000,
      creditsOutstanding: 1,
      checkedAt: null,
      now,
    });
    expect(h.unknown).toBe(true);
  });

  it("marks a reading older than a day stale", () => {
    const old = new Date(
      now.getTime() - (BALANCE_STALE_AFTER_HOURS + 1) * 3_600_000,
    );
    const h = smsBalanceHealth({
      providerBalance: 8_000,
      creditsOutstanding: 1_000,
      checkedAt: old,
      now,
    });
    expect(h.stale).toBe(true);
    // Still compared: a stale surplus is worth seeing, it just is not proof.
    expect(h.drift).toBe(7_000);
  });

  it("does not mark a reading inside the window stale", () => {
    const recent = new Date(
      now.getTime() - (BALANCE_STALE_AFTER_HOURS - 1) * 3_600_000,
    );
    expect(
      smsBalanceHealth({
        providerBalance: 1,
        creditsOutstanding: 1,
        checkedAt: recent,
        now,
      }).stale,
    ).toBe(false);
  });
});

describe("parseProviderBalance", () => {
  it("reads a plain number", () => {
    expect(parseProviderBalance("8000")).toBe(8000);
  });

  it("reads a grouped number", () => {
    expect(parseProviderBalance("8,000")).toBe(8000);
  });

  it("reads a number with words around it", () => {
    expect(parseProviderBalance("8000 SMS remaining")).toBe(8000);
  });

  it("truncates a decimal rather than rounding up", () => {
    // Half an SMS is not an SMS anyone can send.
    expect(parseProviderBalance("8000.9")).toBe(8000);
  });

  it("returns null for text with no number in it", () => {
    // Not 0: an unreadable balance is unknown, and reading it as zero would
    // raise an oversold alarm on every platform whose provider words its
    // reply differently.
    expect(parseProviderBalance("unavailable")).toBeNull();
  });

  it("returns null for nothing at all", () => {
    expect(parseProviderBalance(null)).toBeNull();
    expect(parseProviderBalance(undefined)).toBeNull();
    expect(parseProviderBalance("")).toBeNull();
  });
});
