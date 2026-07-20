"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/academics/status-badge";
import { AcademicYearDialog } from "@/components/academics/academic-year-dialog";
import { setActiveAcademicYear, useAcademicsState } from "@/lib/academics/store";
import type { AcademicYear } from "@/lib/academics/types";
import { shortDate } from "@/lib/academics/format";
import { toast } from "@/lib/toast";

export default function AcademicYearsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<AcademicYear | null>(null);

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading academic years…
      </div>
    );
  }

  const years = [...state.academicYears].sort((a, b) => b.name.localeCompare(a.name));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Academic Years</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Only one academic year can be active at a time. Fix a typo any time
            with Edit — years are never deleted, since classes, students, and
            records all hang off them.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Add Academic Year
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {years.map((y) => (
          <div
            key={y.id}
            className="rounded-2xl border bg-card p-5 shadow-sm"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <CalendarCheck className="h-5 w-5" />
                </span>
                <div>
                  <p className="text-lg font-bold">{y.name}</p>
                  <p className="text-xs text-muted-foreground">Academic Year</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <StatusBadge status={y.status} />
                <button
                  type="button"
                  onClick={() => setEditing(y)}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"
                  aria-label={`Edit ${y.name}`}
                  title="Edit name or dates"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Start Date</dt>
                <dd className="font-medium">{shortDate(y.startDate)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">End Date</dt>
                <dd className="font-medium">{shortDate(y.endDate)}</dd>
              </div>
            </dl>
            {y.status !== "ACTIVE" && (
              <Button
                variant="outline"
                className="mt-4 w-full"
                onClick={async () => {
                  const res = await setActiveAcademicYear(y.id);
                  toast(
                    res.ok
                      ? `${y.name} is now the active academic year.`
                      : res.error ?? "Failed to set active year.",
                    res.ok ? "success" : "error",
                  );
                }}
              >
                Set as Active
              </Button>
            )}
          </div>
        ))}
      </div>

      <AcademicYearDialog open={open} onClose={() => setOpen(false)} />
      <AcademicYearDialog
        open={!!editing}
        onClose={() => setEditing(null)}
        year={editing}
      />
    </div>
  );
}
