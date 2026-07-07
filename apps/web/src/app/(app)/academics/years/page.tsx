"use client";

import { useEffect, useState } from "react";
import { CalendarCheck, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusBadge } from "@/components/academics/status-badge";
import { AcademicYearDialog } from "@/components/academics/academic-year-dialog";
import { setActiveAcademicYear, useAcademicsState } from "@/lib/academics/store";
import { shortDate } from "@/lib/academics/format";
import { toast } from "@/lib/toast";

export default function AcademicYearsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const state = useAcademicsState();
  const [open, setOpen] = useState(false);

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
            Only one academic year can be active at a time. Closed years are read-only.
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
              <StatusBadge status={y.status} />
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
                onClick={() => {
                  setActiveAcademicYear(y.id);
                  toast(`${y.name} is now the active academic year.`, "success");
                }}
              >
                Set as Active
              </Button>
            )}
          </div>
        ))}
      </div>

      <AcademicYearDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
