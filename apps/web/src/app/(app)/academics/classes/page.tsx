"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowDownUp,
  Eye,
  FileDown,
  Layers,
  Pencil,
  Plus,
  Printer,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { StatusBadge } from "@/components/academics/status-badge";
import { ClassFormDialog } from "@/components/academics/class-form-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  classRows,
  canCreateClassInYear,
  deleteClass,
  exportClassesCsv,
  getAcademicsState,
  useAcademicsState,
} from "@/lib/academics/store";
import { printTable } from "@/lib/academics/print";
import type { ClassRow, SchoolClass } from "@/lib/academics/types";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

type SortKey = "name" | "studentCount" | "subjectCount";
type SortDir = "asc" | "desc";
const PAGE_SIZE = 10;

export default function ClassesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [status, setStatus] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("name");
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [page, setPage] = useState(1);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<SchoolClass | null>(null);
  const [deleting, setDeleting] = useState<ClassRow | null>(null);

  const years = getAcademicsState().academicYears;
  const activeYearName = years.find((y) => y.status === "ACTIVE")?.name ?? "";
  const filterYear = year || activeYearName;
  const canAddClass = canCreateClassInYear(filterYear);

  const rows = useMemo(() => {
    const list = classRows({
      academicYear: year || undefined,
      search,
      status: status || undefined,
    });
    list.sort((a, b) => {
      let cmp = 0;
      if (sortKey === "name")
        cmp = a.name.localeCompare(b.name, undefined, { numeric: true });
      else cmp = (a[sortKey] as number) - (b[sortKey] as number);
      return sortDir === "asc" ? cmp : -cmp;
    });
    return list;
  }, [state, search, year, status, sortKey, sortDir]);

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE,
  );

  useEffect(() => setPage(1), [search, year, status, sortKey, sortDir]);

  const hasFilters = !!(search || year || status);

  function toggleSort(key: SortKey) {
    if (sortKey === key) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(key);
      setSortDir("asc");
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    const res = await deleteClass(deleting.id);
    if (!res.ok) toast(res.error ?? "Delete failed.", "error");
    else toast(`${deleting.name} deleted.`, "success");
    setDeleting(null);
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading classes…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Classes / Grades</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Each academic year has up to 12 grades. Rename grades to match your
            school&apos;s naming — sections are managed separately.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printTable({
                title: "Classes List",
                academicYear:
                  year ||
                  getAcademicsState().academicYears.find(
                    (y) => y.status === "ACTIVE",
                  )?.name,
                columns: [
                  "Class",
                  "Sections",
                  "Students",
                  "Subjects",
                  "Teachers",
                  "Status",
                ],
                rows: rows.map((r) => [
                  r.name,
                  r.sectionCount,
                  r.studentCount,
                  r.subjectCount,
                  r.teacherCount,
                  r.status,
                ]),
              })
            }
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              exportClassesCsv();
              toast(`Exported ${rows.length} classes.`, "info");
            }}
          >
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          {canAddClass ? (
            <Button
              onClick={() => {
                setEditing(null);
                setFormOpen(true);
              }}
            >
              <Plus className="mr-2 h-4 w-4" /> Add Class
            </Button>
          ) : null}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search classes…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex">
            <Select
              value={year}
              onChange={(e) => setYear(e.target.value)}
              className="lg:w-40"
            >
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y.id} value={y.name}>
                  {y.name}
                </option>
              ))}
            </Select>
            <Select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="lg:w-32"
            >
              <option value="">All Status</option>
              <option value="ACTIVE">Active</option>
              <option value="INACTIVE">Inactive</option>
            </Select>
            {hasFilters && (
              <Button
                variant="ghost"
                onClick={() => {
                  setSearch("");
                  setYear("");
                  setStatus("");
                }}
              >
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="max-h-[600px] overflow-auto scrollbar-slim">
          <table className="w-full min-w-[860px] text-sm">
            <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-4 py-3 font-medium">#</th>
                <SortTh
                  label="Class Name"
                  active={sortKey === "name"}
                  dir={sortDir}
                  onClick={() => toggleSort("name")}
                />
                <th className="px-4 py-3 font-medium">Academic Year</th>
                <th className="px-4 py-3 font-medium">Sections</th>
                <SortTh
                  label="Students"
                  active={sortKey === "studentCount"}
                  dir={sortDir}
                  onClick={() => toggleSort("studentCount")}
                />
                <SortTh
                  label="Subjects"
                  active={sortKey === "subjectCount"}
                  dir={sortDir}
                  onClick={() => toggleSort("subjectCount")}
                />
                <th className="px-4 py-3 font-medium">Teachers</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 text-right font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td
                    colSpan={9}
                    className="px-4 py-16 text-center text-muted-foreground"
                  >
                    No classes match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((r, i) => (
                  <tr key={r.id} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">
                      {(currentPage - 1) * PAGE_SIZE + i + 1}
                    </td>
                    <td className="px-4 py-3">
                      <Link
                        href={`/academics/classes/${r.id}`}
                        className="font-medium hover:text-primary hover:underline"
                      >
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {r.academicYear}
                    </td>
                    <td className="px-4 py-3">
                      {r.hasSections ? (
                        <span className="inline-flex items-center gap-1 text-muted-foreground">
                          <Layers className="h-3.5 w-3.5" /> {r.sectionCount}
                        </span>
                      ) : (
                        <span className="text-xs text-muted-foreground">
                          No sections
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{r.studentCount}</td>
                    <td className="px-4 py-3 tabular-nums">{r.subjectCount}</td>
                    <td className="px-4 py-3 tabular-nums">{r.teacherCount}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={r.status} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Action
                          href={`/academics/classes/${r.id}`}
                          title="View Profile"
                          icon={Eye}
                        />
                        <Action
                          title="Rename"
                          icon={Pencil}
                          onClick={() => {
                            const cls =
                              getAcademicsState().classes.find(
                                (c) => c.id === r.id,
                              ) ?? null;
                            setEditing(cls);
                            setFormOpen(true);
                          }}
                        />
                        <Action
                          title="Delete"
                          icon={Trash2}
                          danger
                          onClick={() => setDeleting(r)}
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
            total={rows.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ClassFormDialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        cls={editing}
      />
      <ConfirmDialog
        open={!!deleting}
        title="Delete Class"
        message={
          deleting
            ? `Delete ${deleting.name}? Classes with enrolled students cannot be deleted.`
            : ""
        }
        onConfirm={handleDelete}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function SortTh({
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
          "inline-flex items-center gap-1 hover:text-foreground",
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

function Action({
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
