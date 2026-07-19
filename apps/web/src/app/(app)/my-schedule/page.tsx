"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import {
  PersonalTimetableView,
  type PersonalTimetableDto,
} from "@/components/timetable/personal-timetable";
import type { TeacherMe } from "@/lib/teachers/api";
import { loadTeacherMe } from "@/lib/teachers/session";
import { toast } from "@/lib/toast";

/**
 * A teacher's own week.
 *
 * Shows the published timetable when the school has one, and otherwise falls
 * back to the assignment list this page used to be. A school that has not
 * generated a timetable yet should not be left staring at an empty page while
 * there is still something useful to show.
 */
export default function MySchedulePage() {
  const [timetables, setTimetables] = useState<PersonalTimetableDto[]>([]);
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void Promise.allSettled([
      api<PersonalTimetableDto[]>("/teacher-portal/timetable"),
      loadTeacherMe(),
    ])
      .then(([tt, profile]) => {
        if (cancelled) return;
        if (tt.status === "fulfilled") setTimetables(tt.value);
        if (profile.status === "fulfilled") setMe(profile.value);
        if (tt.status === "rejected" && profile.status === "rejected") {
          toast("Could not load your schedule", "error");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const rows = useMemo(() => {
    if (!me) return [];
    return [...me.assignments].sort((a, b) => {
      const y = a.academicYear.name.localeCompare(b.academicYear.name);
      if (y) return y;
      const c = a.class.name.localeCompare(b.class.name);
      if (c) return c;
      return a.subject.name.localeCompare(b.subject.name);
    });
  }, [me]);

  const hasTimetable = timetables.length > 0;
  const lessonCount = timetables.reduce((sum, t) => sum + t.lessons.length, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {hasTimetable
            ? `Your weekly timetable — ${lessonCount} lessons.`
            : "Your assigned classes, sections, and subjects."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : hasTimetable ? (
        <PersonalTimetableView
          timetables={timetables}
          emptyMessage="No timetable published yet."
        />
      ) : rows.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No teaching assignments yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/40 text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Academic year</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Subject</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{a.academicYear.name}</td>
                  <td className="px-4 py-3">{a.class.name}</td>
                  <td className="px-4 py-3">{a.section?.name ?? "All sections"}</td>
                  <td className="px-4 py-3 font-medium">{a.subject.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t px-4 py-2 text-xs text-muted-foreground">
            Once your school publishes a timetable, this page shows your weekly
            grid instead.
          </p>
        </div>
      )}
    </div>
  );
}
