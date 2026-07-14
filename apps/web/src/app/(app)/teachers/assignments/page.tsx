"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { AssignmentFormDialog } from "@/components/teachers/assignment-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  deleteAssignment,
  useTeachersState,
} from "@/lib/teachers/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { classNamesForYear, useAcademicsState } from "@/lib/academics/store";
import { sectionLabel, statusLabel } from "@/lib/teachers/format";
import type { TeacherAssignment } from "@/lib/teachers/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 12;

export default function TeacherAssignmentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { teachers, assignments } = useTeachersState();
  const academics = useAcademicsState();
  const teacherMap = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [page, setPage] = useState(1);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<TeacherAssignment | null>(null);
  const [deleting, setDeleting] = useState<TeacherAssignment | null>(null);

  const classOptions = useMemo(
    () => classNamesForYear(year || undefined),
    [year, academics.classes],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return assignments.filter((a) => {
      if (year && a.academicYear !== year) return false;
      if (klass && a.className !== klass) return false;
      const t = teacherMap.get(a.teacherId);
      if (q) {
        const hay = `${t?.fullName ?? ""} ${t?.code ?? ""} ${a.className} ${a.subject}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [assignments, search, year, klass, teacherMap]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, year, klass]);

  if (!mounted) {
    return <div className="flex h-64 items-center justify-center text-muted-foreground">Loading assignments…</div>;
  }

  return (
    <div className="space-y-6">
      <Link href="/teachers" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to Teachers
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Teacher Assignments</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each teacher can hold many independent class, section, and subject
            assignments. Assign multiple subjects in one step.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Assign Subjects
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search teacher, class, or subject…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <AcademicYearSelect value={year} onChange={setYear} allowAll className="sm:w-36" />
          <Select value={klass} onChange={(e) => setKlass(e.target.value)} className="sm:w-36">
            <option value="">All Classes</option>
            {classOptions.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </Select>
          {(search || year || klass) && (
            <Button variant="ghost" onClick={() => { setSearch(""); setYear(""); setKlass(""); }}>
              <X className="mr-1 h-4 w-4" /> Clear
            </Button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[900px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Teacher</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Subject</th>
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-16 text-center text-muted-foreground">
                    No assignments found.
                  </td>
                </tr>
              ) : (
                pageRows.map((a, i) => {
                  const t = teacherMap.get(a.teacherId);
                  return (
                    <tr key={a.id} className="border-t hover:bg-secondary/40">
                      <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                      <td className="px-4 py-3">
                        <Link href={`/teachers/${a.teacherId}`} className="font-medium hover:text-primary hover:underline">
                          {t?.fullName ?? "—"}
                        </Link>
                        <p className="font-mono text-xs text-muted-foreground">{t?.code}</p>
                      </td>
                      <td className="px-4 py-3">{a.className}</td>
                      <td className="px-4 py-3">{sectionLabel(a.section)}</td>
                      <td className="px-4 py-3">{a.subject}</td>
                      <td className="px-4 py-3">{a.academicYear}</td>
                      <td className="px-4 py-3">
                        <Badge tone={a.status === "ACTIVE" ? "success" : "muted"}>
                          {statusLabel(a.status)}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex justify-end gap-1">
                          <button onClick={() => { setEditing(a); setFormOpen(true); }} className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-secondary" title="Edit">
                            <Pencil className="h-4 w-4" />
                          </button>
                          <button onClick={() => setDeleting(a)} className="flex h-8 w-8 items-center justify-center rounded-lg text-rose-600 hover:bg-rose-500/10" title="Delete">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      <AssignmentFormDialog
        open={formOpen}
        onClose={() => { setFormOpen(false); setEditing(null); }}
        teacherId={editing?.teacherId}
        assignment={editing}
        onSaved={(m) => toast(m)}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete Assignment"
        message={deleting ? `Remove ${deleting.subject} assignment for ${deleting.className}?` : ""}
        onConfirm={async () => {
          if (deleting) {
            const res = await deleteAssignment(deleting.id);
            toast(res.ok ? "Assignment deleted." : res.error ?? "Failed", res.ok ? "success" : "error");
          }
          setDeleting(null);
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
