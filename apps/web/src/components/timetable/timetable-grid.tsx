"use client";

import { useMemo, useState } from "react";
import { formatMinutes, WEEKDAY_NAMES } from "@ekulmis/shared";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import type { TimetableDetail } from "@/lib/timetable/api";

type View = "class" | "teacher";

/**
 * The finished timetable, in the two shapes a school actually uses it in: one
 * grid per class to pin on the wall, and one per teacher to hand out. They are
 * the same data read along different axes, so they share one component.
 */
export function TimetableGrid({ timetable }: { timetable: TimetableDetail }) {
  const [view, setView] = useState<View>("class");
  const [who, setWho] = useState<string>("");

  const teaching = useMemo(
    () => timetable.shift.periods.filter((p) => !p.isBreak),
    [timetable.shift.periods],
  );
  const days = timetable.shift.days;

  const subjects = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const e of timetable.entries) {
      const key = `${e.classId}:${e.sectionId ?? ""}`;
      const label = e.section ? `${e.class.name} ${e.section.name}` : e.class.name;
      map.set(key, { key, label });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [timetable.entries]);

  const teachers = useMemo(() => {
    const map = new Map<string, { key: string; label: string }>();
    for (const e of timetable.entries) {
      if (e.teacher) map.set(e.teacher.id, { key: e.teacher.id, label: e.teacher.fullName });
    }
    return [...map.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [timetable.entries]);

  const options = view === "class" ? subjects : teachers;
  const selected = who && options.some((o) => o.key === who) ? who : options[0]?.key ?? "";

  const cellAt = (day: number, periodId: string) =>
    timetable.entries.find((e) => {
      if (e.dayOfWeek !== day || e.shiftPeriodId !== periodId) return false;
      return view === "class"
        ? `${e.classId}:${e.sectionId ?? ""}` === selected
        : e.teacher?.id === selected;
    });

  const lessonCount = timetable.entries.filter((e) =>
    view === "class"
      ? `${e.classId}:${e.sectionId ?? ""}` === selected
      : e.teacher?.id === selected,
  ).length;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="inline-flex rounded-lg border p-0.5">
          {(["class", "teacher"] as const).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => {
                setView(v);
                setWho("");
              }}
              className={cn(
                "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                view === v
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              By {v}
            </button>
          ))}
        </div>
        <div className="w-56">
          <Select value={selected} onChange={(e) => setWho(e.target.value)}>
            {options.map((o) => (
              <option key={o.key} value={o.key}>
                {o.label}
              </option>
            ))}
          </Select>
        </div>
        <span className="text-sm text-muted-foreground">
          {lessonCount} lessons / week
        </span>
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[640px] text-sm">
          <thead>
            <tr className="border-b bg-secondary/40 text-left">
              <th className="w-32 px-3 py-2 text-xs font-medium text-muted-foreground">
                Period
              </th>
              {days.map((d) => (
                <th key={d} className="px-3 py-2 text-xs font-medium">
                  {WEEKDAY_NAMES[d]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {timetable.shift.periods.map((period) => {
              if (period.isBreak) {
                return (
                  <tr key={period.id} className="border-b bg-secondary/30">
                    <td
                      colSpan={days.length + 1}
                      className="px-3 py-1.5 text-center text-xs font-medium text-muted-foreground"
                    >
                      {period.name} · {formatMinutes(period.startMinute)} –{" "}
                      {formatMinutes(period.endMinute)}
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={period.id} className="border-b last:border-0">
                  <td className="px-3 py-2 align-top">
                    <div className="font-medium">{period.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatMinutes(period.startMinute)}–
                      {formatMinutes(period.endMinute)}
                    </div>
                  </td>
                  {days.map((d) => {
                    const cell = cellAt(d, period.id);
                    return (
                      <td key={d} className="px-3 py-2 align-top">
                        {cell ? (
                          <>
                            <div className="font-medium">{cell.subject.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {view === "class"
                                ? (cell.teacher?.fullName ?? "Unassigned")
                                : cell.section
                                  ? `${cell.class.name} ${cell.section.name}`
                                  : cell.class.name}
                            </div>
                          </>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Free periods are worth seeing at a glance on a teacher's sheet. */}
      {view === "teacher" && (
        <p className="text-xs text-muted-foreground">
          Blank cells are free periods.
        </p>
      )}
    </div>
  );
}
