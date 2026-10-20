import { Injectable } from "@nestjs/common";
import type { SystemHealthCheck } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

/** The host monitor runs every five minutes (cron on the server). */
export const CHECK_EVERY_MIN = 5;
/** No row for this long means the server, or the monitor, is down. */
export const STALE_AFTER_MIN = 12;

export type SystemStatus = "OK" | "PROBLEM" | "NOT_REPORTING" | "NO_DATA";

export interface SystemIncident {
  kind: "OUTAGE" | "PROBLEM";
  startedAt: string;
  /** Null while it is still going on. */
  endedAt: string | null;
  minutes: number;
  message: string;
}

const MIN = 60_000;

function percentile(values: number[], p: number): number | null {
  if (values.length === 0) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))]!;
}

function average(values: number[]): number | null {
  return values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
}

/**
 * Incidents from the check history: runs of failing checks, and gaps where
 * no check arrived at all — the server was off, so nothing could report it
 * at the time. A gap that ends with a newer boot time was a restart.
 */
export function incidentsFrom(
  rows: Pick<SystemHealthCheck, "checkedAt" | "ok" | "problems" | "bootedAt">[],
  now: Date,
): SystemIncident[] {
  const out: SystemIncident[] = [];
  let run: { start: Date; end: Date; problems: Set<string> } | null = null;
  const closeRun = (ongoing: boolean) => {
    if (!run) return;
    out.push({
      kind: "PROBLEM",
      startedAt: run.start.toISOString(),
      endedAt: ongoing ? null : run.end.toISOString(),
      minutes: Math.max(CHECK_EVERY_MIN, Math.round(((ongoing ? now : run.end).getTime() - run.start.getTime()) / MIN)),
      message: [...run.problems].join("; ") || "Check failed",
    });
    run = null;
  };

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]!;
    const prev = rows[i - 1];
    if (prev && r.checkedAt.getTime() - prev.checkedAt.getTime() > STALE_AFTER_MIN * MIN) {
      closeRun(false);
      const restarted = r.bootedAt && r.bootedAt > prev.checkedAt;
      out.push({
        kind: "OUTAGE",
        startedAt: prev.checkedAt.toISOString(),
        endedAt: r.checkedAt.toISOString(),
        minutes: Math.round((r.checkedAt.getTime() - prev.checkedAt.getTime()) / MIN),
        message: restarted
          ? `Server was off and restarted at ${r.bootedAt!.toISOString().slice(0, 16).replace("T", " ")} UTC`
          : "No checks arrived — the server or the monitor was down",
      });
    }
    if (!r.ok) {
      if (!run) run = { start: r.checkedAt, end: r.checkedAt, problems: new Set() };
      run.end = r.checkedAt;
      for (const p of (r.problems ?? "").split(";").map((x) => x.trim()).filter(Boolean)) {
        run.problems.add(p);
      }
    } else {
      closeRun(false);
    }
  }
  const last = rows[rows.length - 1];
  closeRun(!!last && !last.ok);

  // Silent right now: still down, or the monitor stopped.
  if (last && now.getTime() - last.checkedAt.getTime() > STALE_AFTER_MIN * MIN) {
    out.push({
      kind: "OUTAGE",
      startedAt: last.checkedAt.toISOString(),
      endedAt: null,
      minutes: Math.round((now.getTime() - last.checkedAt.getTime()) / MIN),
      message: "No checks since then — the server or the monitor is down",
    });
  }
  return out.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

@Injectable()
export class SystemHealthService {
  constructor(private readonly prisma: PrismaService) {}

  async report(now = new Date()) {
    const rows = await this.prisma.systemHealthCheck.findMany({
      where: { checkedAt: { gte: new Date(now.getTime() - 7 * 24 * 60 * MIN) } },
      orderBy: { checkedAt: "asc" },
    });
    const latest = rows[rows.length - 1] ?? null;
    const minutesSinceLast = latest
      ? Math.round((now.getTime() - latest.checkedAt.getTime()) / MIN)
      : null;
    const status: SystemStatus = !latest
      ? "NO_DATA"
      : minutesSinceLast! > STALE_AFTER_MIN
        ? "NOT_REPORTING"
        : latest.ok
          ? "OK"
          : "PROBLEM";

    // Last 24 hours. Missing checks count as down: a server that was off
    // could not report itself, and its silence is the outage.
    const dayStart = new Date(now.getTime() - 24 * 60 * MIN);
    const day = rows.filter((r) => r.checkedAt >= dayStart);
    const monitoredFrom = day[0]?.checkedAt ?? now;
    const expected = Math.max(
      day.length,
      Math.floor((now.getTime() - monitoredFrom.getTime()) / (CHECK_EVERY_MIN * MIN)) + 1,
    );
    const okCount = day.filter((r) => r.ok).length;
    const api = day.map((r) => r.apiMs).filter((v): v is number => v !== null);
    const web = day.map((r) => r.webMs).filter((v): v is number => v !== null);

    return {
      status,
      checkedAt: latest?.checkedAt ?? null,
      minutesSinceLast,
      checkEveryMinutes: CHECK_EVERY_MIN,
      latest,
      last24h: {
        checks: day.length,
        expected,
        okChecks: okCount,
        uptimePct: expected ? Math.min(100, Math.round((okCount / expected) * 1000) / 10) : null,
        apiAvgMs: average(api),
        apiP95Ms: percentile(api, 95),
        webAvgMs: average(web),
        webP95Ms: percentile(web, 95),
      },
      series: day.map((r) => ({
        t: r.checkedAt,
        apiMs: r.apiMs,
        webMs: r.webMs,
        ok: r.ok,
      })),
      incidents: incidentsFrom(rows, now).slice(0, 50),
      recent: rows.slice(-12).reverse(),
    };
  }
}
