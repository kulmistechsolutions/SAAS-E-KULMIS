"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useT } from "@/lib/i18n/provider";
import { ArrowLeft, Download, Gift, Printer, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { refreshStudents, useStudentsState, withParents } from "@/lib/students/store";
import { DEFAULT_STUDENT_EXPORT_FIELDS, exportStudentsCsv, printStudentsList } from "@/lib/students/print";
import { shortDate } from "@/lib/students/format";
import {
  activeAcademicYear,
  groupClassesByStructure,
  useAcademicsState,
} from "@/lib/academics/store";
import type { StudentWithParent } from "@/lib/students/types";

export default function FreeStudentsPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    void refreshStudents();
  }, []);

  const studentsState = useStudentsState();
  const academics = useAcademicsState();

  const [year, setYear] = useState("");
  useEffect(() => {
    if (!year && academics.academicYears.length) {
      setYear(activeAcademicYear() || academics.academicYears[0]?.name || "");
    }
  }, [academics.academicYears, year]);

  const [klass, setKlass] = useState("");
  const [search, setSearch] = useState("");

  const yearClasses = useMemo(
    () => academics.classes.filter((c) => c.academicYear === year),
    [academics.classes, year],
  );
  const yearClassGroups = useMemo(
    () =>
      groupClassesByStructure(
        yearClasses,
        (c) => c.name,
        year,
        t("common.defaultGrades"),
      ),
    [yearClasses, year, academics.structureTrees, t],
  );

  const freeStudents = useMemo(() => {
    return withParents(studentsState).filter(
      (s) =>
        s.status === "ACTIVE" &&
        (s.feeWaived || s.monthlyFee === 0) &&
        (!year || s.academicYear === year) &&
        (!klass || s.className === klass) &&
        (!search ||
          s.fullName.toLowerCase().includes(search.toLowerCase()) ||
          s.code.toLowerCase().includes(search.toLowerCase())),
    );
  }, [studentsState, year, klass, search]);

  function reason(s: StudentWithParent): string {
    return s.feeWaived
      ? t("financeFreeStudents.reasonWaived")
      : t("financeFreeStudents.reasonZeroFee");
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("attendanceStudents.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/finance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("financeFreeStudents.backToFeeManagement")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Gift className="h-6 w-6 text-teal-500" />
            {t("financeFreeStudents.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("financeFreeStudents.description")}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            onClick={() =>
              printStudentsList(freeStudents, {
                academicYear: year,
                className: klass || t("attendanceStudents.allClasses"),
                section: "",
              })
            }
          >
            <Printer className="me-2 h-4 w-4" /> {t("attendanceStudents.print")}
          </Button>
          <Button
            variant="outline"
            onClick={() =>
              exportStudentsCsv(freeStudents, DEFAULT_STUDENT_EXPORT_FIELDS, "free-students.csv")
            }
          >
            <Download className="me-2 h-4 w-4" /> {t("students.download")}
          </Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 text-white shadow-lg">
            <Gift className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">
              {t("financeFreeStudents.totalFreeStudents")}
            </p>
            <p className="text-3xl font-bold tabular-nums">{freeStudents.length}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("attendanceStudents.academicYear")}
          </label>
          <Select value={year} onChange={(e) => { setYear(e.target.value); setKlass(""); }}>
            {academics.academicYears.map((y) => (
              <option key={y.id} value={y.name}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("attendanceStudents.class")}
          </label>
          <Select value={klass} onChange={(e) => setKlass(e.target.value)}>
            <option value="">{t("attendanceStudents.allClasses")}</option>
            {yearClassGroups.map((g) =>
              g.label === null ? (
                g.items.map((c) => (
                  <option key={c.id} value={c.name}>
                    {c.name}
                  </option>
                ))
              ) : (
                <optgroup key={g.label} label={g.label}>
                  {g.items.map((c) => (
                    <option key={c.id} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </Select>
        </div>
        <div className="relative min-w-[220px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeFreeStudents.search")}
          </label>
          <Search className="pointer-events-none absolute start-3 top-[34px] h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="ps-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("attendanceStudents.searchStudent")}
          />
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">#</th>
                <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.studentId")}</th>
                <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.name")}</th>
                <th className="px-4 py-2.5 font-medium">{t("attendanceStudents.class")}</th>
                <th className="px-4 py-2.5 font-medium">{t("students.section")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeFreeStudents.parent")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeFreeStudents.reason")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeFreeStudents.registered")}</th>
              </tr>
            </thead>
            <tbody>
              {freeStudents.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-muted-foreground">
                    {t("financeFreeStudents.noFreeStudents")}
                  </td>
                </tr>
              ) : (
                freeStudents.map((s, i) => (
                  <tr key={s.id} className="border-t">
                    <td className="px-4 py-2.5 text-muted-foreground">{i + 1}</td>
                    <td className="px-4 py-2.5 font-mono text-xs">{s.code}</td>
                    <td className="px-4 py-2.5 font-medium">
                      <Link href={`/students/${s.id}`} className="hover:text-primary hover:underline">
                        {s.fullName}
                      </Link>
                    </td>
                    <td className="px-4 py-2.5">{s.className}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.section ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{s.parent.name}</td>
                    <td className="px-4 py-2.5">
                      <Badge tone="info">
                        <Gift className="h-3 w-3" /> {reason(s)}
                      </Badge>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {shortDate(s.registrationDate)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
