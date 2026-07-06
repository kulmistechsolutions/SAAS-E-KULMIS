"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Card } from "@/components/ui/card";

interface StudentRow {
  id: string;
  code: string;
  fullName: string;
  gender: string;
  status: string;
  class: { name: string } | null;
  section: { name: string } | null;
  parent: { code: string; name: string } | null;
}

export default function StudentsPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["students"],
    queryFn: () => api<StudentRow[]>("/students"),
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Students</h1>

      <Card className="overflow-hidden">
        <table className="w-full text-sm">
          <thead className="border-b bg-secondary/50 text-left text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">#</th>
              <th className="px-4 py-3 font-medium">Student ID</th>
              <th className="px-4 py-3 font-medium">Name</th>
              <th className="px-4 py-3 font-medium">Gender</th>
              <th className="px-4 py-3 font-medium">Class / Section</th>
              <th className="px-4 py-3 font-medium">Parent</th>
              <th className="px-4 py-3 font-medium">Status</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  Loading…
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-destructive">
                  Failed to load students.
                </td>
              </tr>
            )}
            {data?.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-6 text-muted-foreground">
                  No students yet.
                </td>
              </tr>
            )}
            {data?.map((s, i) => (
              <tr key={s.id} className="border-b last:border-0 hover:bg-secondary/30">
                <td className="px-4 py-3 text-muted-foreground">{i + 1}</td>
                <td className="px-4 py-3 font-mono text-xs">{s.code}</td>
                <td className="px-4 py-3 font-medium">{s.fullName}</td>
                <td className="px-4 py-3">{s.gender}</td>
                <td className="px-4 py-3">
                  {s.class?.name ?? "—"}
                  {s.section ? ` / ${s.section.name}` : ""}
                </td>
                <td className="px-4 py-3">
                  {s.parent ? `${s.parent.name} (${s.parent.code})` : "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="rounded bg-secondary px-2 py-0.5 text-xs">
                    {s.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
