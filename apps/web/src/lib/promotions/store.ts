"use client";

import { useSyncExternalStore } from "react";
import { ApiError } from "@/lib/api";
import {
  activeAcademicYear,
  classByName,
  getAcademicsState,
} from "@/lib/academics/store";
import { getState as getStudentsState, refreshStudents } from "@/lib/students/store";
import { isStudentBlocked } from "@/lib/examinations/store";
import { outstandingBalance } from "@/lib/fees/store";
import type { Student } from "@/lib/students/types";
import {
  apiGraduatedStudents,
  apiPromoteClass,
  apiPromoteStudent,
  apiPromotionHistory,
  type ApiGraduatedStudent,
  type ApiPromotionRecord,
} from "./api";
import { isFinalClass, nextClassName } from "./format";
import type {
  EligibilityIssue,
  GraduatedStudentRow,
  PromotionCandidate,
  PromotionDashboardSummary,
  PromotionPreview,
  PromotionRecord,
  PromotionsState,
  PromotionSettings,
  PromotionType,
} from "./types";

const DEFAULT_SETTINGS: PromotionSettings = {
  requirePublishedResults: false,
  requireNoOutstandingFees: false,
  requireMinimumPass: false,
  requireClearance: false,
};

const EMPTY: PromotionsState = {
  history: [],
  settings: DEFAULT_SETTINGS,
  audit: [],
};

let state: PromotionsState | null = null;
let graduatedCache: GraduatedStudentRow[] = [];
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): PromotionsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem("ekulmis_promotions_settings_v1");
  let settings = DEFAULT_SETTINGS;
  if (raw) {
    try {
      settings = { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as PromotionSettings) };
    } catch {
      /* ignore */
    }
  }
  state = { ...EMPTY, settings };
  if (!loaded) {
    loaded = true;
    void refreshPromotions();
  }
  return state;
}

function setState(next: PromotionsState) {
  state = next;
  emit();
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

function yearIdByName(name: string): string | undefined {
  return getAcademicsState().academicYears.find((y) => y.name === name)?.id;
}

function classNameById(id: string): string {
  return getAcademicsState().classes.find((c) => c.id === id)?.name ?? "—";
}

function sectionNameById(id: string | null): string | null {
  if (!id) return null;
  return getAcademicsState().sections.find((s) => s.id === id)?.name ?? null;
}

function yearNameById(id: string): string {
  return getAcademicsState().academicYears.find((y) => y.id === id)?.name ?? id;
}

function mapPromotionRecord(r: ApiPromotionRecord): PromotionRecord {
  const toClass = r.toClassId
    ? getAcademicsState().classes.find((c) => c.id === r.toClassId)
    : undefined;
  return {
    id: r.id,
    studentId: r.studentId,
    studentCode: r.student.code,
    studentName: r.student.fullName,
    type: r.type,
    fromAcademicYear: yearNameById(r.academicYearId),
    fromClass: classNameById(r.fromClassId),
    fromSection: sectionNameById(r.fromSectionId),
    toAcademicYear: toClass?.academicYear ?? yearNameById(r.academicYearId),
    toClass: r.toClassId ? classNameById(r.toClassId) : r.student.class.name,
    toSection: sectionNameById(r.toSectionId),
    graduated: r.graduated,
    promotedAt: r.promotedAt,
    promotedBy: r.promotedByUserId ?? "Admin",
  };
}

function mapGraduated(g: ApiGraduatedStudent, history: PromotionRecord[]): GraduatedStudentRow {
  const gradRecord = history.find((r) => r.studentId === g.id && r.graduated);
  const st = getStudentsState();
  const parent = st.parents.find((p) => p.id === g.parentId);
  return {
    studentId: g.id,
    studentCode: g.code,
    studentName: g.fullName,
    parentName: parent?.name ?? "—",
    graduationYear: gradRecord?.fromAcademicYear ?? g.class?.academicYear?.name ?? "",
    finalClass: gradRecord?.fromClass ?? g.class?.name ?? "",
    finalSection: gradRecord?.fromSection ?? g.section?.name ?? null,
    graduationDate: gradRecord?.promotedAt ?? g.updatedAt,
  };
}

export async function refreshPromotions(academicYearId?: string): Promise<void> {
  try {
    const [history, graduated] = await Promise.all([
      apiPromotionHistory(academicYearId),
      apiGraduatedStudents(),
    ]);
    const mappedHistory = history.map(mapPromotionRecord);
    graduatedCache = graduated.map((g) => mapGraduated(g, mappedHistory));
    setState({ ...ensure(), history: mappedHistory });
  } catch {
    /* keep cache */
  }
}

export function getPromotionsState(): PromotionsState {
  return ensure();
}

export function usePromotionsState(): PromotionsState {
  return useSyncExternalStore(subscribe, getPromotionsState, () => EMPTY);
}

export function resetPromotions() {
  void refreshPromotions();
}

function logAudit(action: string, detail?: string, user = "Admin User", role = "ADMINISTRATOR") {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `pra_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        action,
        user,
        role,
        at: new Date().toISOString(),
        detail,
      },
      ...s.audit,
    ].slice(0, 300),
  });
}

export function getSettings(): PromotionSettings {
  return ensure().settings;
}

export function updateSettings(patch: Partial<PromotionSettings>) {
  const s = ensure();
  const settings = { ...s.settings, ...patch };
  setState({ ...s, settings });
  if (typeof window !== "undefined") {
    localStorage.setItem("ekulmis_promotions_settings_v1", JSON.stringify(settings));
  }
  logAudit("Promotion Settings Updated", JSON.stringify(patch));
}

export function orderedClassNames(year?: string): string[] {
  const s = getAcademicsState();
  const y = year ?? activeAcademicYear();
  return s.classes
    .filter((c) => c.academicYear === y && c.status === "ACTIVE")
    .map((c) => c.name)
    .sort((a, b) => {
      const na = Number(a.replace(/\D/g, ""));
      const nb = Number(b.replace(/\D/g, ""));
      if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
      return a.localeCompare(b, undefined, { numeric: true });
    });
}

export function suggestedNextClass(className: string, year?: string): string | null {
  return nextClassName(className, orderedClassNames(year));
}

export function classIsFinal(className: string, year?: string): boolean {
  return isFinalClass(className, orderedClassNames(year));
}

export function sectionsForClassName(className: string, year?: string): string[] {
  const s = getAcademicsState();
  const y = year ?? activeAcademicYear();
  const cls = s.classes.find((c) => c.name === className && c.academicYear === y);
  if (!cls) return [];
  return s.sections
    .filter((sec) => sec.classId === cls.id && sec.status === "ACTIVE")
    .map((sec) => sec.name)
    .sort();
}

function alreadyPromotedThisYear(studentId: string, fromYear: string): boolean {
  return ensure().history.some(
    (r) => r.studentId === studentId && r.fromAcademicYear === fromYear && !r.rolledBackAt,
  );
}

export function evaluateStudent(student: Student): PromotionCandidate {
  const settings = ensure().settings;
  const issues: EligibilityIssue[] = [];
  const year = student.academicYear;

  if (student.status === "GRADUATED") {
    issues.push({ code: "GRADUATED", label: "Already graduated" });
  } else if (student.status !== "ACTIVE") {
    issues.push({ code: "INACTIVE", label: "Student is inactive" });
  }

  if (alreadyPromotedThisYear(student.id, year)) {
    issues.push({ code: "ALREADY_PROMOTED", label: "Already promoted this year" });
  }

  let outstanding = 0;
  try {
    outstanding = outstandingBalance(student.id);
  } catch {
    outstanding = 0;
  }

  if (settings.requirePublishedResults || settings.requireMinimumPass) {
    const result = null;
    if (!result && settings.requirePublishedResults) {
      issues.push({ code: "NO_RESULTS", label: "No published final results" });
    }
  }

  if (settings.requireNoOutstandingFees && outstanding > 0) {
    issues.push({ code: "OUTSTANDING_FEES", label: `Outstanding fees ($${outstanding})` });
  }

  if (settings.requireClearance && isStudentBlocked(student.id)) {
    issues.push({ code: "BLOCKED", label: "Blocked / clearance required" });
  }

  const graduating = classIsFinal(student.className, year);

  return {
    studentId: student.id,
    studentCode: student.code,
    studentName: student.fullName,
    gender: student.gender,
    currentClass: student.className,
    currentSection: student.section ?? null,
    eligible: issues.length === 0,
    graduating,
    outstandingFees: outstanding,
    issues,
  };
}

export function buildPreview(opts: {
  academicYear: string;
  fromClass: string;
  fromSection?: string | null;
  toClass?: string | null;
  toSection?: string | null;
}): PromotionPreview {
  const { academicYear, fromClass } = opts;
  const students = getStudentsState().students.filter(
    (s) =>
      s.academicYear === academicYear &&
      s.className === fromClass &&
      (opts.fromSection ? (s.section ?? "") === opts.fromSection : true),
  );

  const candidates = students
    .map((s) => evaluateStudent(s))
    .sort((a, b) => a.studentName.localeCompare(b.studentName));

  const graduating = classIsFinal(fromClass, academicYear);
  const eligible = candidates.filter((c) => c.eligible).length;

  return {
    fromClass,
    fromSection: opts.fromSection ?? null,
    toClass: graduating ? null : opts.toClass ?? suggestedNextClass(fromClass, academicYear),
    toSection: opts.toSection ?? null,
    graduating,
    total: candidates.length,
    eligible,
    ineligible: candidates.length - eligible,
    candidates,
  };
}

export interface PromotionResult {
  ok: boolean;
  error?: string;
  promoted: number;
  graduated: number;
  skipped: number;
}

export async function promoteStudents(opts: {
  type: PromotionType;
  academicYear: string;
  studentIds: string[];
  toClass?: string | null;
  toSection?: string | null;
  toAcademicYear?: string;
}): Promise<PromotionResult> {
  const students = getStudentsState().students;
  const yearId = yearIdByName(opts.academicYear);
  if (!yearId) return { ok: false, error: "Academic year not found.", promoted: 0, graduated: 0, skipped: 0 };

  const targets = students.filter((st) => opts.studentIds.includes(st.id));
  if (targets.length === 0) {
    return { ok: false, error: "No students selected.", promoted: 0, graduated: 0, skipped: 0 };
  }

  let promoted = 0;
  let graduated = 0;
  let skipped = 0;

  const toClassId = opts.toClass ? classByName(opts.toClass, opts.toAcademicYear ?? opts.academicYear)?.id : null;
  const toSectionId =
    opts.toSection && toClassId
      ? getAcademicsState().sections.find((s) => s.classId === toClassId && s.name === opts.toSection)?.id
      : null;

  try {
    for (const student of targets) {
      const candidate = evaluateStudent(student);
      if (!candidate.eligible) {
        skipped += 1;
        continue;
      }
      const graduate = candidate.graduating;
      if (!graduate && !toClassId) {
        skipped += 1;
        continue;
      }
      if (!graduate && toClassId === classByName(student.className, opts.academicYear)?.id) {
        skipped += 1;
        continue;
      }

      await apiPromoteStudent({
        studentId: student.id,
        academicYearId: yearId,
        toClassId: graduate ? null : toClassId,
        toSectionId: graduate ? null : toSectionId,
        graduate,
      });

      if (graduate) graduated += 1;
      else promoted += 1;
    }

    if (promoted === 0 && graduated === 0) {
      return { ok: false, error: "No eligible students to promote.", promoted: 0, graduated: 0, skipped };
    }

    await Promise.all([refreshPromotions(yearId), refreshStudents()]);
    logAudit(
      graduated > 0 && promoted === 0 ? "Student Graduated" : "Promotion Completed",
      `${opts.type}: ${promoted} promoted, ${graduated} graduated, ${skipped} skipped`,
    );
    return { ok: true, promoted, graduated, skipped };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Promotion failed."), promoted, graduated, skipped };
  }
}

export async function promoteClass(opts: {
  academicYear: string;
  fromClass: string;
  fromSection?: string | null;
  toClass?: string | null;
  toSection?: string | null;
  graduate?: boolean;
}): Promise<PromotionResult> {
  const yearId = yearIdByName(opts.academicYear);
  const fromClass = classByName(opts.fromClass, opts.academicYear);
  if (!yearId || !fromClass) {
    return { ok: false, error: "Class or year not found.", promoted: 0, graduated: 0, skipped: 0 };
  }
  const fromSectionId = opts.fromSection
    ? getAcademicsState().sections.find((s) => s.classId === fromClass.id && s.name === opts.fromSection)?.id
    : null;
  const toClassId = opts.toClass ? classByName(opts.toClass, opts.academicYear)?.id : null;
  const toSectionId =
    opts.toSection && toClassId
      ? getAcademicsState().sections.find((s) => s.classId === toClassId && s.name === opts.toSection)?.id
      : null;

  try {
    const res = await apiPromoteClass({
      academicYearId: yearId,
      fromClassId: fromClass.id,
      fromSectionId,
      toClassId,
      toSectionId,
      graduate: opts.graduate ?? false,
    });
    await Promise.all([refreshPromotions(yearId), refreshStudents()]);
    logAudit("Class Promotion Completed", `${res.promoted} students`);
    return { ok: true, promoted: res.promoted, graduated: opts.graduate ? res.promoted : 0, skipped: 0 };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Class promotion failed."), promoted: 0, graduated: 0, skipped: 0 };
  }
}

export async function promoteSchoolWide(academicYear: string): Promise<PromotionResult> {
  const students = getStudentsState().students.filter(
    (s) => s.academicYear === academicYear && s.status === "ACTIVE",
  );
  return promoteStudents({
    type: "SCHOOL_WIDE",
    academicYear,
    studentIds: students.map((s) => s.id),
    toAcademicYear: academicYear,
  });
}

export function canRollback(_record: PromotionRecord): boolean {
  return false;
}

export function rollbackPromotion(_recordId: string): { ok: boolean; error?: string } {
  return { ok: false, error: "Rollback is not supported via API yet." };
}

export function dashboardSummary(): PromotionDashboardSummary {
  const s = ensure();
  const year = activeAcademicYear();
  const students = getStudentsState().students;
  const activeThisYear = students.filter((st) => st.academicYear === year && st.status === "ACTIVE");
  const eligible = activeThisYear.filter((st) => evaluateStudent(st).eligible).length;
  const promotedThisYear = s.history.filter(
    (r) => !r.rolledBackAt && !r.graduated && r.fromAcademicYear === year,
  ).length;
  const graduatedTotal = students.filter((st) => st.status === "GRADUATED").length;
  const inactive = students.filter((st) => st.status === "INACTIVE").length;
  const active = s.history.filter((r) => !r.rolledBackAt);
  const lastPromotionDate = active.length > 0 ? active[0].promotedAt : null;

  return {
    currentAcademicYear: year,
    eligibleForPromotion: eligible,
    totalPromoted: promotedThisYear,
    totalGraduated: graduatedTotal,
    totalInactive: inactive,
    pendingPromotions: Math.max(0, eligible - promotedThisYear),
    lastPromotionDate,
  };
}

export function studentPromotionHistory(studentId: string): PromotionRecord[] {
  return ensure()
    .history.filter((r) => r.studentId === studentId)
    .sort((a, b) => new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime());
}

export function promotionHistory(opts?: {
  search?: string;
  academicYear?: string;
  type?: PromotionType;
  includeRolledBack?: boolean;
}): PromotionRecord[] {
  let rows = [...ensure().history];
  if (!opts?.includeRolledBack) rows = rows.filter((r) => !r.rolledBackAt);
  if (opts?.academicYear) rows = rows.filter((r) => r.fromAcademicYear === opts.academicYear);
  if (opts?.type) rows = rows.filter((r) => r.type === opts.type);
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q) ||
        r.fromClass.toLowerCase().includes(q) ||
        r.toClass.toLowerCase().includes(q),
    );
  }
  return rows.sort((a, b) => new Date(b.promotedAt).getTime() - new Date(a.promotedAt).getTime());
}

export function graduatedStudents(opts?: {
  search?: string;
  academicYear?: string;
}): GraduatedStudentRow[] {
  let rows = [...graduatedCache];
  if (opts?.academicYear) rows = rows.filter((r) => r.graduationYear === opts.academicYear);
  if (opts?.search?.trim()) {
    const q = opts.search.trim().toLowerCase();
    rows = rows.filter(
      (r) =>
        r.studentName.toLowerCase().includes(q) ||
        r.studentCode.toLowerCase().includes(q) ||
        r.parentName.toLowerCase().includes(q),
    );
  }
  return rows.sort((a, b) => a.studentName.localeCompare(b.studentName));
}

export function getAuditLog(): PromotionsState["audit"] {
  return ensure().audit;
}

export function exportPromotionHistoryCsv(rows: PromotionRecord[]) {
  const header =
    "Student ID,Student Name,Type,From Year,From Class,From Section,To Year,To Class,To Section,Graduated,Date\n";
  const body = rows
    .map((r) =>
      [
        r.studentCode,
        r.studentName,
        r.type,
        r.fromAcademicYear,
        r.fromClass,
        r.fromSection ?? "",
        r.toAcademicYear,
        r.toClass,
        r.toSection ?? "",
        r.graduated ? "Yes" : "No",
        new Date(r.promotedAt).toLocaleDateString(),
      ].join(","),
    )
    .join("\n");
  downloadCsv(header + body, "promotion-history.csv");
}

export function exportGraduatedCsv(rows: GraduatedStudentRow[]) {
  const header = "Student ID,Student Name,Parent,Graduation Year,Final Class,Final Section,Graduation Date\n";
  const body = rows
    .map((r) =>
      [
        r.studentCode,
        r.studentName,
        r.parentName,
        r.graduationYear,
        r.finalClass,
        r.finalSection ?? "",
        r.graduationDate ? new Date(r.graduationDate).toLocaleDateString() : "",
      ].join(","),
    )
    .join("\n");
  downloadCsv(header + body, "graduated-students.csv");
}

function downloadCsv(content: string, filename: string) {
  const blob = new Blob([content], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
