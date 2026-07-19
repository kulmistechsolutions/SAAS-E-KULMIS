"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { usePortal } from "@/components/parent-portal/portal-context";
import {
  PersonalTimetableView,
  type PersonalTimetableDto,
} from "@/components/timetable/personal-timetable";

/** The selected child's published class timetable. */
export default function ParentTimetablePage() {
  const { selectedChild } = usePortal();
  const [timetables, setTimetables] = useState<PersonalTimetableDto[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChild) {
      setTimetables([]);
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void api<PersonalTimetableDto[]>(
      `/parent-portal/children/${selectedChild.id}/timetable`,
    )
      .then((res) => {
        if (!cancelled) setTimetables(res);
      })
      // A school that has not published a timetable is the normal case, not an
      // error worth shouting about — the empty state below says it plainly.
      .catch(() => {
        if (!cancelled) setTimetables([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedChild]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Class Timetable</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {selectedChild
            ? `${selectedChild.fullName}'s weekly lessons.`
            : "Select a child to see their week."}
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : (
        <PersonalTimetableView
          timetables={timetables}
          emptyMessage="Your school has not published a timetable yet."
        />
      )}
    </div>
  );
}
