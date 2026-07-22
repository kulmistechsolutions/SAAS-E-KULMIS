"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  Download,
  Eye,
  FileDown,
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
import { SummaryCards } from "@/components/students/summary-cards";
import { StudentFormDialog } from "@/components/students/student-form-dialog";
import { StudentAvatar } from "@/components/students/student-avatar";
import { ImportDialog } from "@/components/students/import-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  bulkDeleteStudents,
  deleteStudent,
  refreshStudents,
  resetStudents,
  summarize,
  useStudentsRefresh,
  useStudentsState,
  withParents,
} from "@/lib/students/store";
import {
  classNamesForYear,
  ensureAcademicsLoaded,
  sectionNamesForClass,
  useAcademicsState,
} from "@/lib/academics/store";
import { defaultAcademicYear } from "@/lib/academics/year-select";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { genderLabel, money, shortDate } from "@/lib/students/format";
import {
  exportStudentsCsv,
  printStudentProfile,
  printStudentsList,
} from "@/lib/students/print";
import type { StudentStatus, StudentWithParent } from "@/lib/students/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SortKey = "fullName" | "code" | "registrationDate" | "className";
type SortDir = "asc" | "desc";

const PAGE_SIZE = 10;

const STATUS_TONE: Record<StudentStatus, "success" | "muted" | "info"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  GRADUATED: "info",
};

export default function StudentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void ensureAcademicsLoaded();
    void refreshStudents();
  }, []);

  const state = useStudentsState();
  const { loading: studentsLoading, failed: studentsFailed } =
    useStudentsRefresh();
  const academics = useAcademicsState();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [klass, setKlass] = useState("");
  const [section, setSection] = useState("");
  const [gender, setGender] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("registrationDate");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [page, setPage] = useState(1);

  useEffect(() => {
    if (!mounted) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get("add") === "1") setFormOpen(true);
  }, [mounted]);

  useEffect(() => {
    if (!mounted || year || academics.academicYears.length === 0) return;
    const active = defaultAcademicYear(academics);
    if (active) setYear(active);
  }, [mounted, year, academics.academicYears]);

  const classOptions = useMemo(
    () => classNamesForYear(year || undefined),
    [year, academics.classes],
  );
  const sectionOptions = useMemo(
    () => (klass ? sectionNamesForClass(klass, year || undefined) : []),
    [klass, year, academics.sections],
  );

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<StudentWithParent | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [deleting, setDeleting] = useState<StudentWithParent | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkConfirm, setBulkConfirm] = useState(false);
  const [bulkBusy, setBulkBusy] = useState(false);

  // Cards reflect the selected academic year so they always agree with the
  // table below (an all-years total next to an empty year-filtered table reads
  // as "the data disappeared").
  const summary = useMemo(
    () =>
      summarize(
        year
          ? state.students.filter((s) => s.academicYear === year)
          : state.students,
      ),
    [state.students, year],
  );
  const all = useMemo(() => withParents(state), [state]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const rows = all.filter((s) => {
      if (year && s.academicYear !== year) return false;
      if (klass && s.className !== klass) return false;
      if (section && (s.section ?? "") !== section) return false;
      if (gender && s.gender !== gender) return false;
      if (status && s.status !== status) return false;
      if (q) {
        const hay =
          `${s.code} ${s.fullName} ${s.parent.name} ${s.parent.phone}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    rows.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "fullName") cmp = a.fullName.localeCompare(b.fullName);
      else if (sortKey === "code") cmp = a.code.localeCompare(b.code);
      else if (sortKey === "registrationDate")
        cmp =
          new Date(a.registrationDate).getTime() -
          new Date(b.registrationDate).getTime();
      else if (sortKey === "className")
        cmp = a.className.localeCompare(b.className, undefined, {
          numeric: true,
        });
      return sortDir === "asc" ? cmp : -cmp;
    });
    return rows;
  }, [all, search, year, klass, section, gender, status, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => {
    setPage(1);
  }, [search, year, klass, section, gender, status, sortKey, sortDir]);

  const hasFilters = !!(search || year || klass || section || gender || status);

  function clearFilters() {
    setSearch("");
    setYear("");
    setKlass("");
    setSection("");
    setGender("");
    setStatus("");
  }

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir(key === "registrationDate" ? "desc" : "asc");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteStudent(deleting.id);
    if (res.ok) {
      toast(
        `${deleting.fullName} deleted.${
          res.parentDeleted
            ? " Parent account removed (no other children)."
            : ""
        }`,
      );
    } else {
      toast(res.error ?? "Delete failed", "error");
    }
    setDeleting(null);
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const pageAllSelected =
    pageRows.length > 0 && pageRows.every((s) => selected.has(s.id));

  function togglePage() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (pageAllSelected) pageRows.forEach((s) => next.delete(s.id));
      else pageRows.forEach((s) => next.add(s.id));
      return next;
    });
  }

  async function handleBulkDelete() {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkBusy(true);
    const res = await bulkDeleteStudents(ids);
    setBulkBusy(false);
    if (res.ok) {
      toast(
        `${res.deletedCount} students deleted.${
          res.parentsDeleted
            ? ` ${res.parentsDeleted} parent account(s) removed.`
            : ""
        } IDs are retired, not reused.`,
        "success",
      );
      setSelected(new Set());
    } else {
      toast(res.error ?? "Bulk delete failed", "error");
    }
    setBulkConfirm(false);
  }

  function handleExport() {
    exportStudentsCsv(filtered);
    toast(`Exported ${filtered.length} students to CSV.`, "info");
  }

  function handlePrint() {
    printStudentsList(filtered, {
      academicYear: year || "All",
      className: klass || "All",
      section: section || "All",
    });
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading students…
      </div>
    );
  }

  // When the selected year simply has no students but other years do, say so
  // explicitly — otherwise the page looks broken ("students disappeared").
  const activeYearName = defaultAcademicYear(academics);
  const tableEmptyMessage = studentsLoading
    ? "Loading students from the server…"
    : studentsFailed
      ? "Could not load students. Try refreshing the page."
      : year && all.length > 0 && all.every((s) => s.academicYear !== year)
        ? `No students in ${year}. ${
            activeYearName && activeYearName !== year
              ? `Switch the year filter to ${activeYearName} (active year) to see them.`
              : "Choose another academic year."
          }`
        : hasFilters
          ? "No students match your filters."
          : "No students registered yet.";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage student records, registration, and profiles.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <Button variant="outline" onClick={() => setImportOpen(true)}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <Button
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="mr-2 h-4 w-4" /> Add Student
          </Button>
        </div>
      </div>

      <SummaryCards summary={summary} />

      {/* Toolbar */}
      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by ID, name, parent, or phone…"
              className="h-10 w-full rounded-lg border border-input bg-background pl-9 pr-3 text-sm outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-nowrap">
            <AcademicYearSelect
              value={year}
              onChange={setYear}
              allowAll
              className="lg:w-36"
            />
            <Select
              value={klass}
              onChange={(e) => {
                setKlass(e.target.value);
                setSection("");
              }}
              className="lg:w-32"
            >
              <option value="">All Classes</option>
              {classOptions.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </Select>
            <Select
              value={section}
              onChange={(e) => setSection(e.target.value)}
              className="lg:w-32"
            >
              <option value="">All Sections</option>
              {sectionOptions.map((s) => (
                <option key={s} value={s}>
                  Section {s}
                </option>
              ))}
            </Select>
            <Select
              value={gender}
              onChange={(e) => setGender(e.target.value)}
              className="lg:w-32"
            >
              <option value="">All Genders</option>
              <option value="MALE">Male</option>
              <option value="FEMALE">Female</option>
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="lg:w-32"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
              <option value="GRADUATED">Graduated</option>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={clearFilters}
                className="lg:w-auto"
              >
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Bulk action bar — appears when rows are selected */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
          <p className="text-sm font-medium">
            {selected.size} student{selected.size === 1 ? "" : "s"} selected
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              className="h-9"
              onClick={() => setSelected(new Set())}
            >
              Clear
            </Button>
            <Button
              variant="destructive"
              className="h-9"
              disabled={bulkBusy}
              onClick={() => setBulkConfirm(true)}
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Delete selected
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[1000px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur">
              <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-3 py-3 font-medium">
                  <input
                    type="checkbox"
                    aria-label="Select all on this page"
                    checked={pageAllSelected}
                    onChange={togglePage}
                    className="h-4 w-4 cursor-pointer accent-primary"
                  />
                </th>
                <th className="px-4 py-3 font-medium">#</th>
                <SortableTh
                  label="Student ID"
                  active={sortKey === "code"}
                  dir={sortDir}
                  onClick={() => toggleSort("code")}
                />
                <SortableTh
                  label="Name"
                  active={sortKey === "fullName"}
                  dir={sortDir}
                  onClick={() => toggleSort("fullName")}
                />
                <th className="px-4 py-3 font-medium">Gender</th>
                <th className="px-4 py-3 font-medium">Parent</th>
                <th className="px-4 py-3 font-medium">Parent Phone</th>
                <SortableTh
                  label="Class"
                  active={sortKey === "className"}
                  dir={sortDir}
                  onClick={() => toggleSort("className")}
                />
                <th className="px-4 py-3 font-medium">Section</th>
                <th className="px-4 py-3 font-medium">Monthly Fee</th>
                <SortableTh
                  label="Reg. Date"
                  active={sortKey === "registrationDate"}
                  dir={sortDir}
                  onClick={() => toggleSort("registrationDate")}
                />
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={13}
                    className="px-4 py-16 text-center text-muted-foreground"
                  >
                    {studentsLoading ? (
                      <span className="inline-flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        {tableEmptyMessage}
                      </span>
                    ) : (
                      tableEmptyMessage
                    )}
                  </td>
                </tr>
              ) : (
                pageRows.map((s, i) => (
                  <tr
                    key={s.id}
                    className={cn(
                      "border-t transition-colors hover:bg-secondary/40",
                      selected.has(s.id) && "bg-primary/5",
                    )}
                  >
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        aria-label={`Select ${s.fullName}`}
                        checked={selected.has(s.id)}
                        onChange={() => toggleOne(s.id)}
                        className="h-4 w-4 cursor-pointer accent-primary"
                      />
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {(currentPage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs font-medium">
                      {s.code}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <StudentAvatar
                          name={s.fullName}
                          studentId={s.id}
                          hasPhoto={s.hasPhoto}
                          photoUrl={s.photoUrl}
                          size="sm"
                          clickable={false}
                        />
                        <Link
                          href={`/students/${s.id}`}
                          className="font-medium text-foreground hover:text-primary hover:underline"
                        >
                          {s.fullName}
                        </Link>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {genderLabel(s.gender)}
                    </td>
                    <td className="px-4 py-3">{s.parent.name}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.parent.phone}
                    </td>
                    <td className="px-4 py-3">{s.className}</td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {s.section ?? "—"}
                    </td>
                    <td className="px-4 py-3 tabular-nums">
                      {money(s.monthlyFee)}
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {shortDate(s.registrationDate)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[s.status]} dot>
                        {s.status.charAt(0) + s.status.slice(1).toLowerCase()}
                      </Badge>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <RowAction
                          href={`/students/${s.id}`}
                          title="View Profile"
                          icon={Eye}
                        />
                        <RowAction
                          title="Edit"
                          icon={Pencil}
                          onClick={() => {
                            setEditing(s);
                            setFormOpen(true);
                          }}
                        />
                        <RowAction
                          title="Print Profile"
                          icon={Printer}
                          onClick={() => printStudentProfile(s)}
                        />
                        <RowAction
                          title="Download Profile"
                          icon={Download}
                          onClick={() =>
                            exportStudentsCsv([s], `${s.code}.csv`)
                          }
                        />
                        <RowAction
                          title="Delete"
                          icon={Trash2}
                          danger
                          onClick={() => setDeleting(s)}
                        />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="border-t px-3">
          <Pagination
            page={currentPage}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      <div className="flex justify-end">
        <button
          onClick={() => {
            resetStudents();
            toast("Demo student data reset.", "info");
          }}
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <RotateCcw className="h-3.5 w-3.5" /> Reset demo data
        </button>
      </div>

      <StudentFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        student={editing}
        onSaved={(msg, tone) => toast(msg, tone ?? "success")}
      />
      <ImportDialog
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onDone={(r) =>
          toast(
            `Import complete: ${r.imported} added, ${r.skipped} skipped, ${r.failed} failed.`,
            r.failed > 0 ? "error" : "success",
          )
        }
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete Student"
        message={
          deleting
            ? `Delete ${deleting.fullName} (${deleting.code})? If this is the parent's only child, the parent account will also be removed. This cannot be undone.`
            : ""
        }
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
      <ConfirmDialog
        open={bulkConfirm}
        title="Delete selected students"
        message={`Delete ${selected.size} selected student${
          selected.size === 1 ? "" : "s"
        }? Their IDs are retired and never reused. A parent is removed only if none of their children remain. This cannot be undone.`}
        onConfirm={handleBulkDelete}
        onClose={() => setBulkConfirm(false)}
      />
    </div>
  );
}

function SortableTh({
  label,
  active,
  dir,
  onClick,
}: {
  label: string;
  active: boolean;
  dir: SortDir;
  onClick: () => void;
}) {
  return (
    <th className="px-4 py-3 font-medium">
      <button
        onClick={onClick}
        className={cn(
          "inline-flex items-center gap-1 uppercase tracking-wide transition-colors hover:text-foreground",
          active && "text-foreground",
        )}
      >
        {label}
        <ArrowDownUp
          className={cn("h-3 w-3", active ? "opacity-100" : "opacity-40")}
        />
        {active && (
          <span className="text-[10px]">{dir === "asc" ? "▲" : "▼"}</span>
        )}
      </button>
    </th>
  );
}

function RowAction({
  icon: Icon,
  title,
  onClick,
  href,
  danger,
}: {
  icon: typeof Eye;
  title: string;
  onClick?: () => void;
  href?: string;
  danger?: boolean;
}) {
  const cls = cn(
    "flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors",
    danger
      ? "hover:bg-rose-500/10 hover:text-rose-600"
      : "hover:bg-secondary hover:text-foreground",
  );
  if (href)
    return (
      <Link href={href} title={title} className={cls}>
        <Icon className="h-4 w-4" />
      </Link>
    );
  return (
    <button onClick={onClick} title={title} className={cls}>
      <Icon className="h-4 w-4" />
    </button>
  );
}
