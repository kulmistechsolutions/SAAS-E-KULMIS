"use client";

import { useEffect, useState } from "react";
import { AlarmClock } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { apiClassAttendanceTimes } from "@/lib/attendance/api";

/**
 * Says so when the chosen class keeps its own attendance times (Attendance →
 * Time Rules). Nothing shows for a class on the school's times, so schools
 * that never set up a rule see the register exactly as before.
 */
export function ClassTimesNote({ classId }: { classId: string }) {
  const t = useT();
  const [note, setNote] = useState<string | null>(null);

  useEffect(() => {
    setNote(null);
    if (!classId) return;
    let live = true;
    apiClassAttendanceTimes(classId)
      .then((r) => {
        if (live && r.rule) {
          setNote(
            t("attendanceTimeRules.registerUsesRule", {
              rule: r.rule.name,
              start: r.times.startTime,
              lock: r.times.lockTime,
            }),
          );
        }
      })
      // Informational only: a failed read must not get in the way of marking.
      .catch(() => {});
    return () => {
      live = false;
    };
  }, [classId, t]);

  if (!note) return null;
  return (
    <div className="flex items-start gap-2 rounded-xl border border-sky-500/30 bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-300">
      <AlarmClock className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{note}</span>
    </div>
  );
}
