"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { apiGetMyStudents } from "@/lib/teachers/api";
import { toast } from "@/lib/toast";

interface MyStudent {
  id: string;
  code: string;
  fullName: string;
  class?: { name: string } | null;
  section?: { name: string } | null;
  parent?: { phone: string | null; name: string } | null;
}

export default function MyStudentsPage() {
  const [students, setStudents] = useState<MyStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");

  useEffect(() => {
    void apiGetMyStudents()
      .then((rows) => setStudents(rows as MyStudent[]))
      .catch(() => toast("Could not load students", "error"))
      .finally(() => setLoading(false));
  }, []);

  const classes = useMemo(
    () =>
      [...new Set(students.map((s) => s.class?.name).filter(Boolean) as string[])].sort(),
    [students],
  );
  const sections = useMemo(
    () =>
      [
        ...new Set(
          students
            .filter((s) => !klass || s.class?.name === klass)
            .map((s) => s.section?.name)
            .filter(Boolean) as string[],
        ),
      ].sort(),
    [students, klass],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return students.filter((s) => {
      if (klass && s.class?.name !== klass) return false;
      if (section && s.section?.name !== section) return false;
      if (!needle) return true;
      return (
        s.fullName.toLowerCase().includes(needle) ||
        s.code.toLowerCase().includes(needle)
      );
    });
  }, [students, q, klass, section]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Read-only list of students in your assigned classes and sections.
        </p>
      </div>

      <div className="flex flex-wrap gap-3 rounded-xl border bg-card p-4">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search by name or student ID…"
            className="pl-9"
          />
        </div>
        <Select
          value={klass}
          onChange={(e) => {
            setKlass(e.target.value);
            setSection("");
          }}
        >
          <option value="">All classes</option>
          {classes.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </Select>
        <Select value={section} onChange={(e) => setSection(e.target.value)}>
          <option value="">All sections</option>
          {sections.map((s) => (
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
          No students match your filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border bg-card">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/80 backdrop-blur">
              <tr className="border-b text-left text-muted-foreground">
                <th className="px-4 py-3 font-medium">Student ID</th>
                <th className="px-4 py-3 font-medium">Student Name</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Parent phone</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} className="border-b last:border-0 hover:bg-muted/30">
                  <td className="px-4 py-3">
                    <Link
                      href={`/students/${s.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {s.code}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{s.fullName}</td>
                  <td className="px-4 py-3">{s.class?.name ?? "—"}</td>
                  <td className="px-4 py-3">{s.section?.name ?? "—"}</td>
                  <td className="px-4 py-3">{s.parent?.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
