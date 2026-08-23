"use client";

import { api, API_URL, TENANT } from "@/lib/api";
import { currencyByCode } from "./currency-defs";
import { buildSettingsSeed } from "./seed";
import type { SettingsState } from "./types";

/**
 * Resolve a logo into a browser-loadable URL. When the storage backend can't
 * produce a direct URL (local filesystem), fall back to the public byte-proxy
 * endpoint — `<img>` tags can't send the tenant header, so the tenant is
 * passed as a query param instead (see tenant.middleware.ts).
 */
export function resolveLogoUrl(
  logoUrl: string | null,
  logoKey: string | null,
): string | null {
  if (logoUrl) return logoUrl;
  if (!logoKey) return null;
  return `${API_URL}/api/settings/logo?tenant=${encodeURIComponent(TENANT)}`;
}

export interface ApiSchool {
  id: string;
  subdomain: string;
  name: string;
  status: string;
  motto: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  academicYear: string | null;
  phone: string | null;
  email: string | null;
  website: string | null;
  principalName: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  stampKey: string | null;
  currency: string;
  timezone: string;
  language: string;
  documentHeaderLayout: "LEFT" | "CENTERED";
  sessionTimeoutMinutes: number | null;
  receiptHeader: string | null;
  receiptFooter: string | null;
  payslipHeader: string | null;
  payslipFooter: string | null;
  expenseHeader: string | null;
  expenseFooter: string | null;
  studentHeader: string | null;
  studentFooter: string | null;
  teacherHeader: string | null;
  teacherFooter: string | null;
  parentHeader: string | null;
  parentFooter: string | null;
  reportHeader: string | null;
  reportFooter: string | null;
  resultFooter: string | null;
  gradeBands: { min: number; max: number; grade: string }[] | null;
  examPassingPercentage: number | null;
  // Whole settings pages, stored as JSON. Null = never customised, so the
  // seed default for that page applies.
  attendanceSettings: SettingsState["attendance"] | null;
  examSettings: Omit<SettingsState["examinations"], "passingPercentage"> | null;
  quizSettings: SettingsState["quiz"] | null;
  academicSettings: Omit<SettingsState["academic"], "passingPercentage"> | null;
  salarySettings: Pick<
    SettingsState["salary"],
    "payrollDay" | "allowPartialSalary" | "currency"
  > | null;
  expenseSettings: Pick<
    SettingsState["expenses"],
    "defaultCategories"
  > | null;
  notificationSettings: SettingsState["notifications"] | null;
  securitySettings: Omit<
    SettingsState["security"],
    "sessionTimeoutMinutes"
  > | null;
  studentPrefix: string;
  studentIdLength: number;
  studentFormTemplate?: "STANDARD" | "DETAILED";
  villageRequired?: boolean;
  districtRequired?: boolean;
  studentPortalEnabled?: boolean;
  teacherPrefix: string;
  parentPrefix: string;
  receiptPrefix: string;
  invoicePrefix: string;
  certificatePrefix: string;
  billingMode?: "MONTHLY" | "ACADEMIC_YEAR";
  feeAcademicMonths?: number;
  feeBillingStartMonth?: number;
  feeBillingEndMonth?: number;
  feeAllowPartial?: boolean;
  feeAllowAdvance?: boolean;
  feeCarryForward?: boolean;
  feeMonthSetupDay?: number;
  registrationFeeAmount?: number;
  // Branding — null means "not chosen", so the app default applies.
  primaryColor?: string | null;
  secondaryColor?: string | null;
  accentColor?: string | null;
  brandLoginTitle?: string | null;
  brandFooterText?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface ApiBranding {
  name: string;
  motto: string | null;
  logoKey: string | null;
  logoUrl: string | null;
  currency: string;
  language: string;
  timezone: string;
  documentHeaderLayout: "LEFT" | "CENTERED";
  // Null means the school never chose one — callers fall back to its name
  // (title), the product default (footer), or the app palette (colours).
  brandLoginTitle: string | null;
  brandFooterText: string | null;
  primaryColor: string | null;
  secondaryColor: string | null;
  accentColor: string | null;
  /** Which self-service entrances this school opened — the staff login page
   *  uses it to point parents and students somewhere that will let them in. */
  portals?: { student: boolean; publicResults: boolean };
}

/** Merge API school record into the UI settings shape (non-persisted sections keep seed defaults). */
export function mapApiSchoolToSettings(
  row: ApiSchool,
  base: SettingsState = buildSettingsSeed(),
): SettingsState {
  return {
    ...base,
    school: {
      ...base.school,
      name: row.name,
      motto: row.motto ?? base.school.motto,
      address: row.address ?? base.school.address,
      city: row.city ?? base.school.city,
      country: row.country ?? base.school.country,
      academicYear: row.academicYear ?? base.school.academicYear,
      phone: row.phone ?? base.school.phone,
      email: row.email ?? base.school.email,
      website: row.website ?? base.school.website,
      principalName: row.principalName ?? base.school.principalName,
      logoDataUrl: resolveLogoUrl(row.logoUrl, row.logoKey),
      currency: row.currency,
      timezone: row.timezone,
      language: row.language,
      documentHeaderLayout: row.documentHeaderLayout,
      reportHeader: row.reportHeader ?? base.school.reportHeader,
      reportFooter: row.reportFooter ?? base.school.reportFooter,
    },
    fees: {
      ...base.fees,
      receiptPrefix: row.receiptPrefix,
      currencySymbol: currencyByCode(row.currency).symbol,
      billingMode: row.billingMode ?? base.fees.billingMode,
      academicMonths: row.feeAcademicMonths ?? base.fees.academicMonths,
      billingStartMonth:
        row.feeBillingStartMonth ?? base.fees.billingStartMonth,
      billingEndMonth: row.feeBillingEndMonth ?? base.fees.billingEndMonth,
      allowPartialPayment: row.feeAllowPartial ?? base.fees.allowPartialPayment,
      allowAdvancePayment: row.feeAllowAdvance ?? base.fees.allowAdvancePayment,
      carryForward: row.feeCarryForward ?? base.fees.carryForward,
      monthSetupDay: row.feeMonthSetupDay ?? base.fees.monthSetupDay,
      registrationFeeAmount:
        row.registrationFeeAmount ?? base.fees.registrationFeeAmount,
      receiptHeader: row.receiptHeader ?? base.fees.receiptHeader,
      receiptFooter: row.receiptFooter ?? base.fees.receiptFooter,
    },
    students: {
      ...base.students,
      idPrefix: row.studentPrefix,
      idLength: row.studentIdLength ?? base.students.idLength,
      formTemplate: row.studentFormTemplate ?? base.students.formTemplate,
      villageRequired: row.villageRequired ?? base.students.villageRequired,
      districtRequired: row.districtRequired ?? base.students.districtRequired,
      portalLoginEnabled:
        row.studentPortalEnabled ?? base.students.portalLoginEnabled,
      studentHeader: row.studentHeader ?? base.students.studentHeader,
      studentFooter: row.studentFooter ?? base.students.studentFooter,
    },
    teachers: {
      ...base.teachers,
      idPrefix: row.teacherPrefix,
      teacherHeader: row.teacherHeader ?? base.teachers.teacherHeader,
      teacherFooter: row.teacherFooter ?? base.teachers.teacherFooter,
    },
    parents: {
      ...base.parents,
      idPrefix: row.parentPrefix,
      parentHeader: row.parentHeader ?? base.parents.parentHeader,
      parentFooter: row.parentFooter ?? base.parents.parentFooter,
    },
    grades: row.gradeBands && row.gradeBands.length > 0 ? row.gradeBands : base.grades,
    // Each stored section replaces its page wholesale; a null one leaves the
    // seed default in place. Spreading over the base keeps a page working if
    // a field is added to it before every school's stored blob has caught up.
    examinations: {
      ...base.examinations,
      ...(row.examSettings ?? {}),
      passingPercentage:
        row.examPassingPercentage ?? base.examinations.passingPercentage,
    },
    attendance: { ...base.attendance, ...(row.attendanceSettings ?? {}) },
    quiz: { ...base.quiz, ...(row.quizSettings ?? {}) },
    academic: { ...base.academic, ...(row.academicSettings ?? {}) },
    salary: {
      ...base.salary,
      ...(row.salarySettings ?? {}),
      payslipHeader: row.payslipHeader ?? base.salary.payslipHeader,
      payslipFooter: row.payslipFooter ?? base.salary.payslipFooter,
    },
    expenses: {
      ...base.expenses,
      ...(row.expenseSettings ?? {}),
      expenseHeader: row.expenseHeader ?? base.expenses.expenseHeader,
      expenseFooter: row.expenseFooter ?? base.expenses.expenseFooter,
    },
    notifications: { ...base.notifications, ...(row.notificationSettings ?? {}) },
    branding: {
      ...base.branding,
      // A saved colour wins; otherwise the seed default stays. Title and footer
      // fall back to being derived from the school's own name.
      primaryColor: row.primaryColor ?? base.branding.primaryColor,
      secondaryColor: row.secondaryColor ?? base.branding.secondaryColor,
      accentColor: row.accentColor ?? base.branding.accentColor,
      loginTitle: row.brandLoginTitle ?? row.name,
      footerText:
        row.brandFooterText ??
        `© ${new Date().getFullYear()} ${row.name}. All rights reserved.`,
    },
    security: {
      ...base.security,
      ...(row.securitySettings ?? {}),
      // Its own column, because auth reads it on every sign-in.
      sessionTimeoutMinutes:
        row.sessionTimeoutMinutes ?? base.security.sessionTimeoutMinutes,
    },
  };
}

export function mapSettingsSectionToPatch(
  key: keyof SettingsState,
  section: SettingsState[keyof SettingsState],
): Record<string, unknown> | null {
  if (key === "school") {
    const s = section as SettingsState["school"];
    return {
      name: s.name,
      motto: s.motto || null,
      address: s.address || null,
      city: s.city || null,
      country: s.country || null,
      academicYear: s.academicYear || null,
      phone: s.phone || null,
      email: s.email || null,
      website: s.website || null,
      principalName: s.principalName || null,
      currency: s.currency,
      timezone: s.timezone,
      language: s.language,
      documentHeaderLayout: s.documentHeaderLayout,
      reportHeader: s.reportHeader || null,
      reportFooter: s.reportFooter || null,
    };
  }
  if (key === "branding") {
    const b = section as SettingsState["branding"];
    // Colours are persisted so a school's choice survives a reload. The
    // favicon and login background are data URLs held in the browser only —
    // they'd bloat the row, and the school logo already covers branded imagery.
    return {
      primaryColor: b.primaryColor,
      secondaryColor: b.secondaryColor,
      accentColor: b.accentColor,
      brandLoginTitle: b.loginTitle || null,
      brandFooterText: b.footerText || null,
    };
  }
  if (key === "security") {
    // Session timeout keeps its own column because auth reads it on every
    // sign-in; the password/lockout rules travel together as one blob.
    const { sessionTimeoutMinutes, ...sec } =
      section as SettingsState["security"];
    return {
      sessionTimeoutMinutes: sessionTimeoutMinutes || null,
      securitySettings: sec,
    };
  }
  if (key === "fees") {
    const f = section as SettingsState["fees"];
    return {
      receiptPrefix: f.receiptPrefix,
      billingMode: f.billingMode,
      feeAcademicMonths: f.academicMonths,
      feeBillingStartMonth: f.billingStartMonth,
      feeBillingEndMonth: f.billingEndMonth,
      feeAllowPartial: f.allowPartialPayment,
      feeAllowAdvance: f.allowAdvancePayment,
      feeCarryForward: f.carryForward,
      feeMonthSetupDay: f.monthSetupDay,
      registrationFeeAmount: f.registrationFeeAmount,
      receiptHeader: f.receiptHeader || null,
      receiptFooter: f.receiptFooter || null,
    };
  }
  if (key === "salary") {
    const s = section as SettingsState["salary"];
    return {
      payslipHeader: s.payslipHeader || null,
      payslipFooter: s.payslipFooter || null,
      salarySettings: {
        payrollDay: s.payrollDay,
        allowPartialSalary: s.allowPartialSalary,
        currency: s.currency,
      },
    };
  }
  if (key === "expenses") {
    const e = section as SettingsState["expenses"];
    return {
      expenseHeader: e.expenseHeader || null,
      expenseFooter: e.expenseFooter || null,
      expenseSettings: {
        defaultCategories: e.defaultCategories,
      },
    };
  }
  if (key === "attendance") {
    return { attendanceSettings: section as SettingsState["attendance"] };
  }
  if (key === "quiz") {
    return { quizSettings: section as SettingsState["quiz"] };
  }
  if (key === "notifications") {
    return {
      notificationSettings: section as SettingsState["notifications"],
    };
  }
  if (key === "academic") {
    const { passingPercentage: _unused, ...a } =
      section as SettingsState["academic"];
    return { academicSettings: a };
  }
  if (key === "students") {
    const s = section as SettingsState["students"];
    return {
      studentPrefix: s.idPrefix,
      studentIdLength: s.idLength,
      studentFormTemplate: s.formTemplate,
      villageRequired: s.villageRequired,
      districtRequired: s.districtRequired,
      studentPortalEnabled: s.portalLoginEnabled,
      studentHeader: s.studentHeader || null,
      studentFooter: s.studentFooter || null,
    };
  }
  if (key === "teachers") {
    const t = section as SettingsState["teachers"];
    return {
      teacherPrefix: t.idPrefix,
      teacherHeader: t.teacherHeader || null,
      teacherFooter: t.teacherFooter || null,
    };
  }
  if (key === "parents") {
    const p = section as SettingsState["parents"];
    return {
      parentPrefix: p.idPrefix,
      parentHeader: p.parentHeader || null,
      parentFooter: p.parentFooter || null,
    };
  }
  if (key === "grades") {
    const g = section as SettingsState["grades"];
    return { gradeBands: g.length > 0 ? g : null };
  }
  if (key === "examinations") {
    // The passing percentage keeps its own column — grading reads it on every
    // result — while the rest of the page travels together as one blob.
    const { passingPercentage, ...e } = section as SettingsState["examinations"];
    return {
      examPassingPercentage: passingPercentage ?? null,
      examSettings: e,
    };
  }
  return null;
}

export async function apiGetSettings(): Promise<SettingsState> {
  const row = await api<ApiSchool>("/settings");
  return mapApiSchoolToSettings(row);
}

export async function apiGetBranding(): Promise<ApiBranding> {
  return api<ApiBranding>("/settings/branding", { auth: false });
}

export async function apiUploadSchoolLogo(
  file: string,
  mimeType: string,
): Promise<SettingsState> {
  const row = await api<ApiSchool>("/settings/logo", {
    method: "POST",
    body: { file, mimeType },
  });
  return mapApiSchoolToSettings(row);
}

export async function apiRemoveSchoolLogo(): Promise<SettingsState> {
  const row = await api<ApiSchool>("/settings/logo", { method: "DELETE" });
  return mapApiSchoolToSettings(row);
}

export async function apiPatchSettings(
  patch: Record<string, unknown>,
): Promise<SettingsState> {
  const row = await api<ApiSchool>("/settings", {
    method: "PATCH",
    body: patch,
  });
  return mapApiSchoolToSettings(row);
}
