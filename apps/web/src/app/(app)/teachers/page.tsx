"use client";


import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  BookOpen,
  Download,
  Eye,
  FileDown,
  KeyRound,
  Pencil,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { SummaryCards } from "@/components/teachers/summary-cards";
import { TeacherFormDialog } from "@/components/teachers/teacher-form-dialog";
import { ImportDialog } from "@/components/teachers/import-dialog";
import { AssignmentFormDialog } from "@/components/teachers/assignment-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  deleteTeacher,
  resetTeacherPassword,
  resetTeachers,
  summarize,
  useTeachersState,
} from "@/lib/teachers/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { activeAcademicYear } from "@/lib/academics/store";
import { money, shiftLabel, shortDate } from "@/lib/teachers/format";
import { DEFAULT_TEACHER_PASSWORD } from "@/lib/teachers/constants";
import { exportTeachersCsv, printTeacherProfile, printTeachersList } from "@/lib/teachers/print";
import type { EmploymentStatus, Teacher } from "@/lib/teachers/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "code" | "registrationDate" | "shift";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

const STATUS_TONE: Record<EmploymentStatus, "success" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
};

/*
 * The API sends these as enum names. The table read "ACTIVE" / "Morning" in
 * every language before, so map them to the dictionary rather than casing the
 * raw value. lib/teachers/format.ts keeps its plain-English helpers for the
 * print and CSV output, which is not localised.
 */
const STATUS_KEY: Record<string, TranslationKey> = {
  ACTIVE: "teachers.statusActive",
  INACTIVE: "teachers.statusInactive",
};

const SHIFT_KEY: Record<string, TranslationKey> = {
  MORNING: "teachers.shiftMorning",
  AFTERNOON: "teachers.shiftAfternoon",
  BOTH: "teachers.shiftBoth",
};

export default function TeachersPage() {
  const tr = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const state = useTeachersState();
  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [shift, setShift] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("registrationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Teacher | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<Teacher | null>(null);
  const [assignTeacher, setAssignTeacher] = useState<Teacher | null>(null);

  const summary = useMemo(() => summarize(state), [state]);

  const assignedThisYear = useMemo(() => {
    const y = year || activeAcademicYear();
    return new Set(
      state.assignments
        .filter((a) => a.academicYear === y && a.status === "ACTIVE")
        .map((a) => a.teacherId),
    );
  }, [state.assignments, year]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = state.teachers.filter((t) => {
      if (shift && t.shift !== shift) return false;
      if (status && t.status !== status) return false;
      if (year && !assignedThisYear.has(t.id)) return false;
      if (q) {
        const hay = `${t.code} ${t.fullName} ${t.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fullName") cmp = a.fullName.localeCompare(b.fullName);
      else if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "registrationDate")
        cmp = new Date(a.registrationDate).getTime() - new Date(b.registrationDate).getTime();
      else if (sortKey === "shift") cmp = a.shift.localeCompare(b.shift);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [state.teachers, search, shift, status, year, assignedThisYear, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, year, shift, status, sortKey, sortDir]);

  const hasFilters = !!(search || year || shift || status);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "registrationDate" ? "desc" : "asc");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteTeacher(deleting.id);
    if (res.ok) toast(`${deleting.fullName} deleted. Assignments and login access removed.`);
    else toast(res.error ?? "Delete failed", "error");
    setDeleting(null);
  }

  async function handleResetPassword(t: Teacher) {
    const res = await resetTeacherPassword(t.id, DEFAULT_TEACHER_PASSWORD);
    if (res.ok && res.password) {
      toast(`Password for ${t.code} reset to ${res.password}`, "info");
    } else if (!res.ok) {
      toast(res.error ?? "Reset failed", "error");
    }
  }

  if (!mounted) {
    return (
      <div
        className="flex h-64 items-center justify-center text-muted-foreground"
        suppressHydrationWarning
      >
        {tr("teachers.loadingTeachers")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{tr("teachers.teachers")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {tr("teachers.manageTeacherRecordsAssignmentsAndCredentials")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/teachers/assignments"
            className="inline-flex h-10 items-center justify-center rounded-md border border-input bg-background px-4 text-sm font-medium transition-colors hover:bg-secondary"
          >
            <BookOpen className="me-2 h-4 w-4" /> {tr("teachers.assignments")}
          </Link>
          <Button variant="outline" onClick={() => printTeachersList(filtered, { shift: shift || "All", status: status || "All" })}>
            <Printer className="me-2 h-4 w-4" /> {tr("teachers.print")}
          </Button>
          <Button variant="outline" onClick={() => { exportTeachersCsv(filtered); toast(`Exported ${filtered.length} teachers.`, "info"); }}>
            <FileDown className="me-2 h-4 w-4" /> {tr("teachers.export")}
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="me-2 h-4 w-4" /> {tr("teachers.import")}
          </Button>
          <Button onClick={() => { setEditing(null); setFormOpen(true); }}>
            <Plus className="me-2 h-4 w-4" /> {tr("teachers.addTeacher")}
          </Button>
        </div>
      </div>

      <SummaryCards summary={summary} />

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={tr("teachers.searchByIdNameOrPhone")}
              className="h-10 w-full rounded-lg border bg-background ps-9 pe-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:flex">
            <AcademicYearSelect value={year} onChange={setYear} allowAll className="lg:w-36" />
            <Select value={shift} onChange={(e) => setShift(e.target.value)} className="lg:w-36">
              <option value="">{tr("teachers.allShifts")}</option>
              <option value="MORNING">{tr("teachers.morning")}</option>
              <option value="AFTERNOON">{tr("teachers.afternoon")}</option>
            </Select>
            <Select value={status} onChange={(e) => setStatus(e.target.value)} className="lg:w-32">
              <option value="">{tr("teachers.allStatus")}</option>
              <option value="ACTIVE">{tr("teachers.active")}</option>
              <option value="INACTIVE">{tr("teachers.inactive")}</option>
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setSearch(""); setYear(""); setShift(""); setStatus(""); }}>
                <X className="me-1 h-4 w-4" /> {tr("teachers.clear")}
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[960px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-start text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <SortTh label={tr("teachers.teacherId")} active={sortKey === "code"} dir={sortDir} onClick={() => toggleSort("code")} />
                <SortTh label={tr("teachers.name")} active={sortKey === "fullName"} dir={sortDir} onClick={() => toggleSort("fullName")} />
                <th className="px-4 py-3 font-medium">{tr("teachers.phone")}</th>
                <SortTh label={tr("teachers.shift")} active={sortKey === "shift"} dir={sortDir} onClick={() => toggleSort("shift")} />
                <th className="px-4 py-3 font-medium">{tr("teachers.salary")}</th>
                <th className="px-4 py-3 font-medium">{tr("teachers.status")}</th>
                <SortTh label={tr("teachers.regDate")} active={sortKey === "registrationDate"} dir={sortDir} onClick={() => toggleSort("registrationDate")} />
                <th className="px-4 py-3 text-end font-medium">{tr("teachers.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-16 text-center text-muted-foreground">
                    {tr("teachers.noTeachersMatchYourFilters")}
                  </td>
                </tr>
              ) : (
                pageRows.map((t, i) => (
                  <tr key={t.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">{t.code}</td>
                    <td className="px-4 py-3">
                      <Link href={`/teachers/${t.id}`} className="font-medium hover:text-primary hover:underline">
                        {t.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{t.phone}</td>
                    <td className="px-4 py-3">{tr(SHIFT_KEY[t.shift] ?? "teachers.shiftBoth")}</td>
                    <td className="px-4 py-3 tabular-nums">{money(t.salary)}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[t.status]} dot>
                        {tr(STATUS_KEY[t.status] ?? "teachers.statusInactive")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(t.registrationDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Action href={`/teachers/${t.id}`} title={tr("teachers.viewProfile")} icon={Eye} />
                        <Action title={tr("teachers.edit")} icon={Pencil} onClick={() => { setEditing(t); setFormOpen(true); }} />
                        <Action title={tr("teachers.assignSubjects")} icon={BookOpen} onClick={() => setAssignTeacher(t)} />
                        <Action href={`/teachers/${t.id}?tab=assignments`} title={tr("teachers.viewAssignments")} icon={BookOpen} />
                        <Action title={tr("teachers.resetPassword")} icon={KeyRound} onClick={() => handleResetPassword(t)} />
                        <Action title={tr("teachers.printProfile")} icon={Printer} onClick={() => printTeacherProfile(t, state.assignments.filter((a) => a.teacherId === t.id))} />
                        <Action title={tr("teachers.download")} icon={Download} onClick={() => exportTeachersCsv([t], `${t.code}.csv`)} />
                        <Action title={tr("teachers.delete")} icon={Trash2} danger onClick={() => setDeleting(t)} />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination page={currentPage} pageCount={pageCount} total={filtered.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
        </div>
      </div>

      <div className="flex justify-end">
        <button onClick={() => { resetTeachers(); toast("Demo teacher data reset.", "info"); }} className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <RotateCcw className="h-3.5 w-3.5" /> {tr("teachers.resetDemoData")}
        </button>
      </div>

      <TeacherFormDialog open={formOpen} onClose={() => setFormOpen(false)} teacher={editing} onSaved={(m) => toast(m)} />
      <ImportDialog open={importOpen} onClose={() => setImportOpen(false)} onDone={(r) => toast(`Import: ${r.imported} added, ${r.skipped} skipped, ${r.failed} failed.`, r.failed ? "error" : "success")} />
      <AssignmentFormDialog open={!!assignTeacher} onClose={() => setAssignTeacher(null)} teacherId={assignTeacher?.id} onSaved={(m) => toast(m)} />
      <ConfirmDialog
        open={!!deleting}
        title={tr("teachers.deleteTeacher")}
        message={deleting ? `Delete ${deleting.fullName} (${deleting.code})? This removes assignments and login access. Historical records are preserved in audit logs.` : ""}
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function SortTh({ label, active, dir, onClick }: { label: string; active: boolean; dir: SortDir; onClick: () => void }) {
  return (
    <th className="px-4 py-3 font-medium">
      <button onClick={onClick} className={cn("inline-flex items-center gap-1 hover:text-foreground", active && "text-foreground")}>
        {label}
        <ArrowDownUp className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")} />
        {active && <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>}
      </button>
    </th>
  );
}

function Action({ icon: Icon, title, onClick, href, danger }: { icon: typeof Eye; title: string; onClick?: () => void; href?: string; danger?: boolean }) {
  const cls = cn("flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors", danger ? "hover:bg-rose-500/10 hover:text-rose-600" : "hover:bg-secondary hover:text-foreground");
  if (href) return <Link href={href} title={title} className={cls}><Icon className="h-4 w-4" /></Link>;
  return <button onClick={onClick} title={title} className={cls}><Icon className="h-4 w-4" /></button>;
}
