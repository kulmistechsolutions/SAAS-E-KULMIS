"use client";

import { useEffect, useMemo, useState } from "react";
import { FileDown, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/academics/status-badge";
import { SectionFormDialog } from "@/components/academics/section-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  deleteSection,
  exportSectionsCsv,
  getAcademicsState,
  sectionRows,
  useAcademicsState,
} from "@/lib/academics/store";
import { printTable } from "@/lib/academics/print";
import type { Section, SectionRow } from "@/lib/academics/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 12;

export default function SectionsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();

  const [search, setSearch] = useState("");
  const [classId, setClassId] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Section | null>(null);
  const [deleting, setDeleting] = useState<SectionRow | null>(null);

  const classes = getAcademicsState().classes.filter(
    (c) => c.academicYear === (getAcademicsState().academicYears.find((y) => y.status === "ACTIVE")?.name ?? ""),
  );

  const rows = useMemo(() => {
    return sectionRows({
      classId: classId || undefined,
      search,
      status: status || undefined,
    }).sort((a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true }) ||
      a.name.localeCompare(b.name),
    );
  }, [state, search, classId, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, classId, status]);

  const hasFilters = !!(search || classId || status);

  function handleDelete() {
    if (!deleting) return;
    const res = deleteSection(deleting.id);
    if (!res.ok) toast(res.error ?? "Delete failed.", "error");
    else toast(`Section deleted.`, "success");
    setDeleting(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading sections…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Sections</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Divide classes into independent classrooms.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printTable({
                title: "Sections List",
                columns: ["Section", "Class", "Academic Year", "Students", "Status"],
                rows: rows.map((r) => [r.name, r.className, r.academicYear, r.studentCount, r.status]),
              })
            }
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => { exportSectionsCsv(); toast(`Exported ${rows.length} sections.`, "info"); }}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="mr-2 h-4 w-4" /> Add Section
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search sections or classes…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select value={classId} onChange={(e) => setClassId(e.target.value)} className="lg:w-44">
              <option value="">All Classes</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-32">
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setSearch(""); setClassId(""); setStatus(""); }}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Class</th>
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Students</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    No sections match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium">Section {r.name}</td>
                    <td className="px-4 py-3">{r.className}</td>
                    <td className="px-4 py-3 text-muted-foreground">{r.academicYear}</td>
                    <td className="px-4 py-3 tabular-nums">{r.studentCount}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          title="Edit"
                          onClick={() => {
                            const sec = getAcademicsState().sections.find((s) => s.id === r.id) ?? null;
                            setEditing(sec);
                            setFormOpen(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title="Delete"
                          onClick={() => setDeleting(r)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination page={currentPage} pageCount={pageCount} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      <SectionFormDialog open={formOpen} onClose={() => setFormOpen(false)} section={editing} />
      <ConfirmDialog
        open={!!deleting}
        title="Delete Section"
        message={deleting ? `Delete Section ${deleting.name} of ${deleting.className}? Sections with enrolled students cannot be deleted.` : ""}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
