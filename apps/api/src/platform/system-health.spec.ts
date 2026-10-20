import { incidentsFrom, SystemHealthService } from "./system-health.service";

/**
 * The host monitor writes one row every five minutes. A run of failing rows is
 * a problem; a gap is the server being off — nothing could report it then.
 */
const T0 = new Date("2026-10-20T10:00:00Z");
const at = (min: number) => new Date(T0.getTime() + min * 60_000);
const row = (min: number, ok = true, problems: string | null = null, bootedAt: Date | null = at(-10_000)) => ({
  checkedAt: at(min),
  ok,
  problems,
  bootedAt,
});

describe("incidents from the check history", () => {
  it("finds nothing in a healthy run", () => {
    expect(incidentsFrom([row(0), row(5), row(10)], at(12))).toEqual([]);
  });

  it("groups consecutive failing checks into one problem with every cause named", () => {
    const rows = [row(0), row(5, false, "API slow (4100ms)"), row(10, false, "API slow (5200ms); Disk 91%"), row(15)];
    const [inc] = incidentsFrom(rows, at(16));
    expect(inc).toMatchObject({ kind: "PROBLEM", endedAt: at(10).toISOString() });
    expect(inc!.message).toBe("API slow (4100ms); API slow (5200ms); Disk 91%");
  });

  it("reports a problem that is still going on as ongoing", () => {
    const [inc] = incidentsFrom([row(0), row(5, false, "Web down")], at(6));
    expect(inc).toMatchObject({ kind: "PROBLEM", endedAt: null });
  });

  it("turns a gap into an outage, and names a restart when the boot time moved", () => {
    const rows = [row(0), row(5), row(60, true, null, at(55))];
    const [inc] = incidentsFrom(rows, at(61));
    expect(inc).toMatchObject({ kind: "OUTAGE", startedAt: at(5).toISOString(), endedAt: at(60).toISOString(), minutes: 55 });
    expect(inc!.message).toMatch(/restarted/);
  });

  it("says so when no check has arrived recently", () => {
    const [inc] = incidentsFrom([row(0), row(5)], at(40));
    expect(inc).toMatchObject({ kind: "OUTAGE", endedAt: null, minutes: 35 });
  });
});

describe("the report", () => {
  function service(rows: ReturnType<typeof row>[]) {
    const full = rows.map((r, i) => ({ id: String(i), apiMs: 50, webMs: 80, ...r }));
    const prisma = { systemHealthCheck: { findMany: jest.fn().mockResolvedValue(full) } };
    return new SystemHealthService(prisma as never);
  }

  it("is OK when the last check passed and is recent", async () => {
    const r = await service([row(0), row(5)]).report(at(7));
    expect(r.status).toBe("OK");
    expect(r.last24h.uptimePct).toBe(100);
  });

  it("is NOT_REPORTING when checks stopped arriving", async () => {
    const r = await service([row(0), row(5)]).report(at(30));
    expect(r.status).toBe("NOT_REPORTING");
  });

  it("counts missing checks as downtime in the uptime figure", async () => {
    // 0,5 then nothing until 30 → 7 expected, 3 arrived and passed.
    const r = await service([row(0), row(5), row(30)]).report(at(30));
    expect(r.last24h.expected).toBe(7);
    expect(r.last24h.uptimePct).toBeCloseTo(42.9, 1);
  });

  it("has no data before the monitor's first check", async () => {
    const r = await service([]).report(at(0));
    expect(r.status).toBe("NO_DATA");
  });
});
