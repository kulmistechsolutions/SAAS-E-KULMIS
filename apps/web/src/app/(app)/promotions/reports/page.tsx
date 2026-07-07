"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  FileDown,
  GraduationCap,
  Printer,
  School,
  User,
  UserX,
  Users,
} from "lucide-react";
import {
  exportGraduatedCsv,
  exportPromotionHistoryCsv,
  graduatedStudents,
  promotionHistory,
} from "@/lib/promotions/store";
import { buildPreview, orderedClassNames } from "@/lib/promotions/store";
import { activeAcademicYear } from "@/lib/academics/store";
import { printTable } from "@/lib/promotions/print";
import { toast } from "@/lib/toast";

export default function PromotionReportsPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading reports…
      </div>
    );
  }

  const year = activeAcademicYear();

  function printHistory(type?: "INDIVIDUAL" | "CLASS" | "SCHOOL_WIDE", title = "Promotion History") {
    const rows = promotionHistory({ type });
    printTable({
      title,
      academicYear: year,
      columns: ["Student", "Type", "From", "To", "Year", "Date"],
      rows: rows.map((r) => [
        `${r.studentName} (${r.studentCode})`,
        r.type,
        `${r.fromClass}${r.fromSection ? ` ${r.fromSection}` : ""}`,
        r.graduated ? "Graduated" : `${r.toClass}${r.toSection ? ` ${r.toSection}` : ""}`,
        r.fromAcademicYear,
        new Date(r.promotedAt).toLocaleDateString(),
      ]),
    });
  }

  function printIneligible() {
    const classes = orderedClassNames(year);
    const candidates = classes.flatMap((c) =>
      buildPreview({ academicYear: year, fromClass: c }).candidates,
    );
    const ineligible = candidates.filter((c) => !c.eligible);
    printTable({
      title: "Ineligible Students Report",
      academicYear: year,
      columns: ["Student", "Class", "Reason"],
      rows: ineligible.map((c) => [
        `${c.studentName} (${c.studentCode})`,
        `${c.currentClass}${c.currentSection ? ` ${c.currentSection}` : ""}`,
        c.issues.map((i) => i.label).join(", "),
      ]),
    });
  }

  function printGraduated() {
    const rows = graduatedStudents();
    printTable({
      title: "Graduated Students Report",
      academicYear: year,
      columns: ["Student ID", "Name", "Grad. Year", "Final Class", "Date"],
      rows: rows.map((r) => [
        r.studentCode,
        r.studentName,
        r.graduationYear,
        r.finalClass,
        r.graduationDate ? new Date(r.graduationDate).toLocaleDateString() : "—",
      ]),
    });
  }

  const REPORTS = [
    { label: "Individual Promotion Report", desc: "Single-student promotions", icon: User, onPrint: () => printHistory("INDIVIDUAL", "Individual Promotion Report"), onCsv: () => exportPromotionHistoryCsv(promotionHistory({ type: "INDIVIDUAL" })) },
    { label: "Class Promotion Report", desc: "Class-level promotions", icon: Users, onPrint: () => printHistory("CLASS", "Class Promotion Report"), onCsv: () => exportPromotionHistoryCsv(promotionHistory({ type: "CLASS" })) },
    { label: "School Promotion Report", desc: "School-wide promotions", icon: School, onPrint: () => printHistory("SCHOOL_WIDE", "School Promotion Report"), onCsv: () => exportPromotionHistoryCsv(promotionHistory({ type: "SCHOOL_WIDE" })) },
    { label: "Promotion History Report", desc: "All promotions combined", icon: FileDown, onPrint: () => printHistory(undefined, "Promotion History Report"), onCsv: () => exportPromotionHistoryCsv(promotionHistory()) },
    { label: "Graduated Students Report", desc: "All graduates on record", icon: GraduationCap, onPrint: printGraduated, onCsv: () => exportGraduatedCsv(graduatedStudents()) },
    { label: "Ineligible Students Report", desc: "Students not yet eligible", icon: UserX, onPrint: printIneligible, onCsv: null },
  ];

  return (
    <div className="space-y-6">
      <Link href="/promotions" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Promotions
      </Link>

      <div>
        <h1 className="text-2xl font-bold">Promotion Reports</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Print or export promotion and graduation reports. Academic Year {year}.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {REPORTS.map((r) => (
          <div key={r.label} className="flex flex-col rounded-2xl border bg-card p-5 shadow-sm">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <r.icon className="h-5 w-5" />
            </span>
            <p className="mt-3 font-semibold">{r.label}</p>
            <p className="mt-0.5 flex-1 text-sm text-muted-foreground">{r.desc}</p>
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => { r.onPrint(); }}
                className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-secondary"
              >
                <Printer className="h-4 w-4" /> Print
              </button>
              {r.onCsv && (
                <button
                  onClick={() => { r.onCsv!(); toast("Report exported.", "info"); }}
                  className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-lg border text-sm font-medium transition-colors hover:bg-secondary"
                >
                  <FileDown className="h-4 w-4" /> CSV
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
