"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { FileDown, Pencil, Plus, Printer, Search, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/academics/status-badge";
import { SubjectFormDialog } from "@/components/academics/subject-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  deleteSubject,
  exportSubjectsCsv,
  getAcademicsState,
  subjectRows,
  useAcademicsState,
} from "@/lib/academics/store";
import { printTable } from "@/lib/academics/print";
import type { Subject, SubjectRow } from "@/lib/academics/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 12;

export default function SubjectsPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();

  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [deleting, setDeleting] = useState<SubjectRow | null>(null);

  const rows = useMemo(() => {
    return subjectRows({ search, status: status || undefined }).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
  }, [state, search, status]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, status]);

  const hasFilters = !!(search || status);

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteSubject(deleting.id);
    if (!res.ok) toast(res.error ?? "Delete failed.", "error");
    else toast(`${deleting.name} deleted.`, "success");
    setDeleting(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("academicsSubjects.loadingSubjects")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{t("academicsSubjects.subjects")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("academicsSubjects.manageSubjectsReusedAcrossClasses")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printTable({
                title: "Subjects List",
                columns: ["Subject", "Code", "Classes", "Teachers", "Status"],
                rows: rows.map((r) => [r.name, r.code ?? "—", r.classCount, r.usedByTeachers, r.status]),
              })
            }
          >
            <Printer className="me-2 h-4 w-4" /> {t("academicsSubjects.print")}
          </Button>
          <Button variant="outline" onClick={() => { exportSubjectsCsv(); toast(`Exported ${rows.length} subjects.`, "info"); }}>
            <FileDown className="me-2 h-4 w-4" /> {t("academicsSubjects.export")}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> {t("academicsSubjects.addSubject")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("academicsSubjects.searchSubjects")}
              className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-32">
              <option value="">{t("academicsSubjects.allStatus")}</option>
              <option value="ACTIVE">{t("academicsSubjects.active")}</option>
              <option value="INACTIVE">{t("academicsSubjects.inactive")}</option>
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setSearch(""); setStatus(""); }}>
                <X className="me-1 h-4 w-4" /> {t("academicsSubjects.clear")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <th className="px-4 py-3 font-medium">{t("academicsSubjects.subject")}</th>
                <th className="px-4 py-3 font-medium">{t("academicsSubjects.code")}</th>
                <th className="px-4 py-3 font-medium">{t("academicsSubjects.classes")}</th>
                <th className="px-4 py-3 font-medium">{t("academicsSubjects.teachers")}</th>
                <th className="px-4 py-3 font-medium">{t("academicsSubjects.status")}</th>
                <th className="px-4 py-3 text-end font-medium">{t("academicsSubjects.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-16 text-center text-muted-foreground">
                    {t("academicsSubjects.noSubjectsMatchYourFilters")}
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-medium">{r.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{r.code ?? "—"}</td>
                    <td className="px-4 py-3 tabular-nums">{r.classCount}</td>
                    <td className="px-4 py-3 tabular-nums">{r.usedByTeachers}</td>
                    <td className="px-4 py-3"><StatusBadge status={r.status} /></td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <button
                          title={t("academicsSubjects.edit")}
                          onClick={() => {
                            const sub = getAcademicsState().subjects.find((s) => s.id === r.id) ?? null;
                            setEditing(sub);
                            setFormOpen(true);
                          }}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                        <button
                          title={t("academicsSubjects.delete")}
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

      <SubjectFormDialog open={formOpen} onClose={() => setFormOpen(false)} subject={editing} />
      <ConfirmDialog
        open={!!deleting}
        title={t("academicsSubjects.deleteSubject")}
        message={deleting ? `Delete ${deleting.name}? Subjects used by teacher assignments or exams cannot be deleted.` : ""}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
