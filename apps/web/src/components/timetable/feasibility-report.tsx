"use client";

import { AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { FeasibilityReport } from "@ekulmis/shared";
import { cn } from "@/lib/utils";

/**
 * The pre-generation check, shown in the school's own terms.
 *
 * Blockers and warnings are kept visually distinct on purpose: a blocker means
 * the timetable is arithmetically impossible and must be fixed, a warning means
 * it will generate but bend a soft rule. Conflating them would either scare a
 * school out of a perfectly good timetable or let it start an impossible one.
 */
export function FeasibilityView({ report }: { report: FeasibilityReport }) {
  const blockers = report.issues.filter((i) => i.level === "BLOCKER");
  const warnings = report.issues.filter((i) => i.level === "WARNING");

  return (
    <div className="space-y-4">
      <div
        className={cn(
          "flex items-start gap-3 rounded-lg border p-4",
          report.ok
            ? "border-emerald-500/40 bg-emerald-500/10"
            : "border-rose-500/40 bg-rose-500/10",
        )}
      >
        {report.ok ? (
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
        ) : (
          <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
        )}
        <div>
          <p className="font-medium">
            {report.ok
              ? "Ready to generate"
              : `${blockers.length} problem${blockers.length === 1 ? "" : "s"} must be fixed first`}
          </p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {report.ok
              ? warnings.length > 0
                ? `${warnings.length} thing${warnings.length === 1 ? "" : "s"} to be aware of, but nothing blocking.`
                : "Every class and teacher fits."
              : "The timetable cannot be built until these add up."}
          </p>
        </div>
      </div>

      {blockers.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-rose-600 dark:text-rose-400">
            Must fix
          </h3>
          <ul className="space-y-1.5">
            {blockers.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm"
              >
                <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {warnings.length > 0 && (
        <section>
          <h3 className="mb-2 text-sm font-semibold text-amber-600 dark:text-amber-400">
            Worth knowing
          </h3>
          <ul className="space-y-1.5">
            {warnings.map((issue, i) => (
              <li
                key={i}
                className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
              >
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>{issue.message}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="overflow-hidden rounded-lg border">
          <h3 className="border-b bg-secondary/40 px-4 py-2 text-sm font-semibold">
            Classes
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {report.classes.map((c) => {
                const exact = c.allocated === c.capacity;
                return (
                  <tr key={`${c.classId}:${c.sectionId ?? ""}`} className="border-b last:border-0">
                    <td className="px-4 py-2">{c.label}</td>
                    <td className="px-4 py-2 text-right tabular-nums">
                      <span
                        className={cn(
                          c.allocated > c.capacity && "text-rose-600 dark:text-rose-400",
                          c.allocated < c.capacity && "text-amber-600 dark:text-amber-400",
                          exact && "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {c.allocated} / {c.capacity}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>

        <section className="overflow-hidden rounded-lg border">
          <h3 className="border-b bg-secondary/40 px-4 py-2 text-sm font-semibold">
            Teacher load
          </h3>
          <table className="w-full text-sm">
            <tbody>
              {report.teachers.map((t) => (
                <tr key={t.teacherId} className="border-b last:border-0">
                  <td className="px-4 py-2">{t.name}</td>
                  <td className="px-4 py-2 text-right tabular-nums">
                    <span
                      className={cn(
                        t.load > t.available && "text-rose-600 dark:text-rose-400",
                      )}
                    >
                      {t.load}
                    </span>
                    <span className="text-muted-foreground"> / {t.available}</span>
                  </td>
                </tr>
              ))}
              {report.teachers.length === 0 && (
                <tr>
                  <td className="px-4 py-6 text-center text-muted-foreground">
                    No teacher has any lessons allocated yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      </div>
    </div>
  );
}
