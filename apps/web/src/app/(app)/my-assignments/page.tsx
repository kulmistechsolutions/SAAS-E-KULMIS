"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { TeacherMe, TeacherMeAssignment } from "@/lib/teachers/api";
import { loadTeacherMe } from "@/lib/teachers/session";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { toast } from "@/lib/toast";

function downloadCsv(rows: TeacherMeAssignment[], fileName: string) {
  const headers = ["Academic Year", "Class", "Section", "Subject"];
  const esc = (v: string) =>
    /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
  const lines = rows.map((a) =>
    [
      a.academicYear.name,
      a.class.name,
      a.section?.name ?? "All",
      a.subject.name,
    ]
      .map(esc)
      .join(","),
  );
  const blob = new Blob([[headers.join(","), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  a.click();
  URL.revokeObjectURL(url);
}

function printAssignments(
  rows: TeacherMeAssignment[],
  teacher: TeacherMe,
  schoolName: string,
) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  const body = rows
    .map(
      (a, i) => `<tr>
      <td>${i + 1}</td>
      <td>${a.academicYear.name}</td>
      <td>${a.class.name}</td>
      <td>${a.section?.name ?? "All"}</td>
      <td>${a.subject.name}</td>
    </tr>`,
    )
    .join("");
  w.document.write(`<!DOCTYPE html><html><head><title>My Assignments</title>
  <style>
    body{font-family:system-ui,sans-serif;padding:24px;color:#111}
    h1{font-size:18px;margin:0}
    p{color:#555;font-size:13px;margin:4px 0 16px}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border:1px solid #ddd;padding:8px;text-align:left}
    th{background:#f5f5f5}
  </style></head><body>
  <h1>${schoolName} — Teaching Assignments</h1>
  <p>${teacher.fullName} (${teacher.code})</p>
  <table><thead><tr>
    <th>#</th><th>Year</th><th>Class</th><th>Section</th><th>Subject</th>
  </tr></thead><tbody>${body}</tbody></table>
  <script>window.onload=()=>window.print()</script>
  </body></html>`);
  w.document.close();
}

export default function MyAssignmentsPage() {
  const branding = useSchoolBranding();
  const [me, setMe] = useState<TeacherMe | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [subject, setSubject] = useState("");

  useEffect(() => {
    void loadTeacherMe()
      .then(setMe)
      .catch(() => toast("Could not load assignments", "error"))
      .finally(() => setLoading(false));
  }, []);

  const years = useMemo(
    () =>
      me
        ? [...new Set(me.assignments.map((a) => a.academicYear.name))].sort()
        : [],
    [me],
  );
  const classes = useMemo(
    () =>
      me
        ? [...new Set(me.assignments.map((a) => a.class.name))].sort()
        : [],
    [me],
  );
  const subjects = useMemo(
    () =>
      me
        ? [...new Set(me.assignments.map((a) => a.subject.name))].sort()
        : [],
    [me],
  );

  const filtered = useMemo(() => {
    if (!me) return [];
    const needle = q.trim().toLowerCase();
    return me.assignments
      .filter((a) => {
        if (year && a.academicYear.name !== year) return false;
        if (klass && a.class.name !== klass) return false;
        if (subject && a.subject.name !== subject) return false;
        if (!needle) return true;
        const hay = [
          a.academicYear.name,
          a.class.name,
          a.section?.name ?? "All",
          a.subject.name,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(needle);
      })
      .sort((a, b) => {
        const y = a.academicYear.name.localeCompare(b.academicYear.name);
        if (y) return y;
        const c = a.class.name.localeCompare(b.class.name);
        if (c) return c;
        return a.subject.name.localeCompare(b.subject.name);
      });
  }, [me, q, year, klass, subject]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">My Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Classes, sections, and subjects assigned to you. If a row shows
            &quot;All&quot; sections, pick a specific section before attendance,
            exams, or quizzes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            disabled={!me || filtered.length === 0}
            onClick={() => downloadCsv(filtered, "my-assignments.csv")}
          >
            <Download className="mr-2 h-4 w-4" />
            CSV / PDF data
          </Button>
          <Button
            variant="outline"
            disabled={!me || filtered.length === 0}
            onClick={() =>
              me && printAssignments(filtered, me, branding.name)
            }
          >
            <Printer className="mr-2 h-4 w-4" />
            Print
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <div className="relative min-w-[200px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search class, section, subject…"
            className="pl-9"
          />
        </div>
        <Select value={year} onChange={(e) => setYear(e.target.value)}>
          <option value="">All years</option>
          {years.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </Select>
        <Select value={klass} onChange={(e) => setKlass(e.target.value)}>
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={subject} onChange={(e) => setSubject(e.target.value)}>
          <option value="">All subjects</option>
          {subjects.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <div className="flex justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          No assignments match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Subject</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a) => (
                <tr key={a.id} className="border-b last:border-0">
                  <td className="px-4 py-3">{a.academicYear.name}</td>
                  <td className="px-4 py-3">{a.class.name}</td>
                  <td className="px-4 py-3">
                    {a.section?.name ?? (
                      <span className="rounded bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-700">
                        All sections
                      </span>
                    )}
                  </td>
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
