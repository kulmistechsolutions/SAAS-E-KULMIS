"use client";

import { useMemo, useState } from "react";
import { AlertTriangle, Check, UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { AllocationRoom, ShiftDto } from "@/lib/timetable/api";

interface Props {
  rooms: AllocationRoom[];
  shifts: ShiftDto[];
  onChange: (
    classId: string,
    sectionId: string | null,
    subjectId: string,
    periodsPerWeek: number,
  ) => void;
  onSave: () => Promise<void>;
  dirty: boolean;
}

/** Weekly slots a classroom has, from its shift's grid. */
function capacityOf(room: AllocationRoom, shifts: ShiftDto[]): number {
  const shift = room.shiftId
    ? shifts.find((s) => s.id === room.shiftId)
    : shifts[0];
  if (!shift) return 0;
  return shift.periods.filter((p) => !p.isBreak).length * shift.days.length;
}

/**
 * The lesson allocation grid — how many periods a subject gets per week.
 *
 * Subjects and teachers are pre-filled from what the school already maintains,
 * so the only genuinely new information is the weekly count. The running
 * total against capacity is shown live: a school discovers it is 2 periods
 * short while typing, not after a failed generation.
 */
export function AllocationGrid({ rooms, shifts, onChange, onSave, dirty }: Props) {
  const [saving, setSaving] = useState(false);

  const totals = useMemo(
    () =>
      rooms.map((room) => ({
        key: `${room.classId}:${room.sectionId ?? ""}`,
        allocated: room.subjects.reduce((s, x) => s + x.periodsPerWeek, 0),
        capacity: capacityOf(room, shifts),
      })),
    [rooms, shifts],
  );

  async function save() {
    setSaving(true);
    try {
      await onSave();
    } finally {
      setSaving(false);
    }
  }

  if (rooms.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        No classes found for this academic year. Add classes and their subjects
        first — this grid fills itself from them.
      </p>
    );
  }

  return (
    <div className="space-y-4">
      {rooms.map((room, roomIndex) => {
        const t = totals[roomIndex]!;
        const over = t.allocated > t.capacity;
        const under = t.allocated < t.capacity;
        return (
          <div key={t.key} className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b bg-secondary/40 px-4 py-2">
              <h3 className="text-sm font-semibold">{room.label}</h3>
              <span
                className={cn(
                  "rounded-full px-2.5 py-0.5 text-xs font-medium",
                  over && "bg-rose-500/12 text-rose-600 dark:text-rose-400",
                  under && "bg-amber-500/12 text-amber-600 dark:text-amber-400",
                  !over &&
                    !under &&
                    "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
                )}
              >
                {t.allocated} / {t.capacity} periods
                {over && ` · ${t.allocated - t.capacity} too many`}
                {under && ` · ${t.capacity - t.allocated} free`}
                {!over && !under && " · exact"}
              </span>
            </div>

            {room.subjects.length === 0 ? (
              <p className="px-4 py-4 text-sm text-muted-foreground">
                No subjects assigned to this class yet.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-xs text-muted-foreground">
                    <th className="px-4 py-2 font-medium">Subject</th>
                    <th className="px-4 py-2 font-medium">Teacher</th>
                    <th className="w-40 px-4 py-2 font-medium">Periods / week</th>
                  </tr>
                </thead>
                <tbody>
                  {room.subjects.map((s) => (
                    <tr key={s.subjectId} className="border-b last:border-0">
                      <td className="px-4 py-2 font-medium">{s.subjectName}</td>
                      <td className="px-4 py-2">
                        {s.teacherName ? (
                          <span className="text-muted-foreground">
                            {s.teacherName}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-rose-600 dark:text-rose-400">
                            <UserX className="h-3.5 w-3.5" />
                            No teacher assigned
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-2">
                        <Input
                          type="number"
                          min={0}
                          max={60}
                          className="h-9 w-24"
                          value={s.periodsPerWeek}
                          onChange={(e) =>
                            onChange(
                              room.classId,
                              room.sectionId,
                              s.subjectId,
                              Math.max(0, Number(e.target.value) || 0),
                            )
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        );
      })}

      <div className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-background/95 px-4 py-3 backdrop-blur">
        <p className="text-xs text-muted-foreground">
          {totals.some((t) => t.allocated > t.capacity) ? (
            <span className="inline-flex items-center gap-1 text-rose-600 dark:text-rose-400">
              <AlertTriangle className="h-3.5 w-3.5" />
              Some classes have more periods than slots — fix before generating.
            </span>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Check className="h-3.5 w-3.5" />
              Counts are saved for the whole year at once.
            </span>
          )}
        </p>
        <Button type="button" onClick={save} disabled={saving || !dirty}>
          {saving ? "Saving…" : dirty ? "Save allocation" : "Saved"}
        </Button>
      </div>
    </div>
  );
}
