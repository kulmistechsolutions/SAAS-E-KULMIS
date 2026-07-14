"use client";

import { useEffect, useMemo, useState } from "react";
import {
  activeAcademicYear,
  ensureAcademicsLoaded,
  useAcademicsState,
} from "./store";
import type { AcademicsState } from "./types";

export function academicYearNames(
  state?: Pick<AcademicsState, "academicYears">,
): string[] {
  const years = state?.academicYears ?? [];
  return [...years].map((y) => y.name).sort((a, b) => b.localeCompare(a));
}

export function defaultAcademicYear(
  state?: Pick<AcademicsState, "academicYears">,
): string {
  const active = state
    ? state.academicYears.find((y) => y.status === "ACTIVE")?.name
    : activeAcademicYear();
  return active ?? academicYearNames(state)[0] ?? "";
}

/** Academic year dropdown state synced with the API-backed academics store. */
export function useAcademicYearSelect(persistKey?: string) {
  const academics = useAcademicsState();
  const years = useMemo(
    () => academicYearNames(academics),
    [academics.academicYears],
  );
  const active = useMemo(
    () => defaultAcademicYear(academics),
    [academics.academicYears],
  );

  const [year, setYearState] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    void ensureAcademicsLoaded();
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted || year) return;
    if (persistKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(persistKey);
      if (saved && (years.includes(saved) || years.length === 0)) {
        setYearState(saved);
        return;
      }
    }
    if (active) setYearState(active);
  }, [mounted, active, year, years, persistKey]);

  useEffect(() => {
    if (!mounted) return;
    if (year && years.length > 0 && !years.includes(year)) {
      setYearState(active || years[0] || "");
    }
  }, [mounted, year, years, active]);

  function setYear(next: string) {
    setYearState(next);
    if (persistKey && typeof window !== "undefined") {
      localStorage.setItem(persistKey, next);
    }
  }

  return { year, setYear, years, active, loading: years.length === 0 };
}
