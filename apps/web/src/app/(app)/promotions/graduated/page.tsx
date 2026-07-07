"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, FileDown, GraduationCap, Printer, Search, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import {
  exportGraduatedCsv,
  graduatedStudents,
  usePromotionsState,
} from "@/lib/promotions/store";
import { getAcademicsState } from "@/lib/academics/store";
import { shortDate } from "@/lib/promotions/format";
import { printTranscript, printTable } from "@/lib/promotions/print";
import { useStudentsState } from "@/lib/students/store";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 12;

export default function GraduatedStudentsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const promotions = usePromotionsState();
  const studentsState = useStudentsState();

  const [search, setSearch] = useState("");
  const [year, setYear] = useState("");
  const [page, setPage] = useState(1);

  const years = getAcademicsState().academicYears;

  const rows = useMemo(
    () => graduatedStudents({ search, academicYear: year || undefined }),
    [promotions, studentsState, search, year],
  );

  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageRows = rows.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => setPage(1), [search, year]);

  const hasFilters = !!(search || year);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading graduated students…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Graduated Students</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Permanent records for students who completed the final class.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printTable({
                title: "Graduated Students Report",
                columns: ["Student ID", "Name", "Parent", "Grad. Year", "Final Class", "Section", "Date"],
                rows: rows.map((r) => [
                  r.studentCode,
                  r.studentName,
                  r.parentName,
                  r.graduationYear,
                  r.finalClass,
                  r.finalSection ?? "—",
                  r.graduationDate ? new Date(r.graduationDate).toLocaleDateString() : "—",
                ]),
              })
            }
          >
            <Printer className="mr-2 h-4 w-4" /> Print
          </Button>
          <Button variant="outline" onClick={() => { exportGraduatedCsv(rows); toast(`Exported ${rows.length} graduates.`, "info"); }}>
            <FileDown className="mr-2 h-4 w-4" /> Export
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
              placeholder="Search by student, ID or parent…"
              className="h-10 w-full rounded-lg border bg-background pl-9 pr-3 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 lg:flex">
            <Select value={year} onChange={(e) => setYear(e.target.value)} className="lg:w-40">
              <option value="">All Years</option>
              {years.map((y) => (
                <option key={y.id} value={y.name}>{y.name}</option>
              ))}
            </Select>
            {hasFilters && (
              <Button variant="ghost" onClick={() => { setSearch(""); setYear(""); }}>
                <X className="mr-1 h-4 w-4" /> Clear
              </Button>
            )}
          </div>
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-2xl border bg-card py-20 text-center shadow-sm">
          <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground/50" />
          <p className="mt-3 text-sm text-muted-foreground">No graduated students yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <div className="max-h-[600px] overflow-auto scrollbar-slim">
            <table className="w-full min-w-[820px] text-sm">
              <thead className="sticky top-0 z-10 bg-secondary/95 backdrop-blur text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Student ID</th>
                  <th className="px-4 py-3 font-medium">Name</th>
                  <th className="px-4 py-3 font-medium">Grad. Year</th>
                  <th className="px-4 py-3 font-medium">Final Class</th>
                  <th className="px-4 py-3 font-medium">Section</th>
                  <th className="px-4 py-3 font-medium">Graduation Date</th>
                  <th className="px-4 py-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((r, i) => (
                  <tr key={r.studentId} className="border-t hover:bg-secondary/40">
                    <td className="px-4 py-3 text-muted-foreground">{(currentPage - 1) * PAGE_SIZE + i + 1}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.studentCode}</td>
                    <td className="px-4 py-3">
                      <Link href={`/students/${r.studentId}`} className="font-medium hover:text-primary hover:underline">
                        {r.studentName}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{r.graduationYear}</td>
                    <td className="px-4 py-3">{r.finalClass}</td>
                    <td className="px-4 py-3">{r.finalSection ? `Section ${r.finalSection}` : "—"}</td>
                    <td className="px-4 py-3 text-muted-foreground">{shortDate(r.graduationDate)}</td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        <Link
                          href={`/students/${r.studentId}`}
                          title="View Profile"
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Eye className="h-4 w-4" />
                        </Link>
                        <button
                          title="Print Transcript"
                          onClick={() => printTranscript(r.studentId)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t px-3">
            <Pagination page={currentPage} pageCount={pageCount} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        </div>
      )}
    </div>
  );
}
