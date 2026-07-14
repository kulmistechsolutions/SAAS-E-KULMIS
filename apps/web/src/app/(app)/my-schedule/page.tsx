"use client";

import { useEffect, useMemo, useState } from "react";
import type { TeacherMe } from "@/lib/teachers/api";
import { loadTeacherMe } from "@/lib/teachers/session";
import { toast } from "@/lib/toast";

export default function MySchedulePage() {
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void loadTeacherMe()
      .then(setMe)
      .catch(() => toast("Could not load schedule", "error"))
      .finally(() => setLoading(false));
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Schedule</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your assigned classes, sections, and subjects.
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
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
        </div>
      )}
    </div>
  );
}
