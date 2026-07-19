"use client";

import { formatMinutes, WEEKDAY_NAMES } from "@ekulmis/shared";

export interface PersonalTimetableDto {
  title: string;
  shiftName: string;
  days: number[];
  periods: {
    id: string;
    name: string;
    startMinute: number;
    endMinute: number;
    isBreak: boolean;
  }[];
  lessons: {
    dayOfWeek: number;
    shiftPeriodId: string;
    subject: string;
    detail: string;
  }[];
}

/**
 * A single person's week — a teacher's own grid, or a student's class grid.
 *
 * Shared by the teacher and parent portals because it is the same shape read by
 * different people; only the second line of each cell differs, and the API
 * already decides that ("detail").
 */
export function PersonalTimetableView({
  timetables,
  emptyMessage,
}: {
  timetables: PersonalTimetableDto[];
  emptyMessage: string;
}) {
  if (timetables.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      {timetables.map((tt) => (
        <div key={tt.shiftName} className="space-y-2">
          {/* Only worth naming the shift when a person works more than one. */}
          {timetables.length > 1 && (
            <h3 className="text-sm font-semibold">{tt.shiftName}</h3>
          )}
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[600px] text-sm">
              <thead>
                <tr className="border-b bg-secondary/40 text-left">
                  <th className="w-28 px-3 py-2 text-xs font-medium text-muted-foreground">
                    Period
                  </th>
                  {tt.days.map((d) => (
                    <th key={d} className="px-3 py-2 text-xs font-medium">
                      {WEEKDAY_NAMES[d]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {tt.periods.map((period) =>
                  period.isBreak ? (
                    <tr key={period.id} className="border-b bg-secondary/30">
                      <td
                        colSpan={tt.days.length + 1}
                        className="px-3 py-1.5 text-center text-xs font-medium text-muted-foreground"
                      >
                        {period.name} · {formatMinutes(period.startMinute)} –{" "}
                        {formatMinutes(period.endMinute)}
                      </td>
                    </tr>
                  ) : (
                    <tr key={period.id} className="border-b last:border-0">
                      <td className="px-3 py-2 align-top">
                        <div className="font-medium">{period.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMinutes(period.startMinute)}–
                          {formatMinutes(period.endMinute)}
                        </div>
                      </td>
                      {tt.days.map((day) => {
                        const lesson = tt.lessons.find(
                          (l) =>
                            l.dayOfWeek === day &&
                            l.shiftPeriodId === period.id,
                        );
                        return (
                          <td key={day} className="px-3 py-2 align-top">
                            {lesson ? (
                              <>
                                <div className="font-medium">{lesson.subject}</div>
                                <div className="text-xs text-muted-foreground">
                                  {lesson.detail}
                                </div>
                              </>
                            ) : (
                              <span className="text-muted-foreground/50">—</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  );
}
