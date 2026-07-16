"use client";

import { api, API_URL, TENANT } from "@/lib/api";
import { buildSettingsSeed } from "./seed";
import type { SettingsState } from "./types";

/**
 * Resolve a logo into a browser-loadable URL. When the storage backend can't
 * produce a direct URL (local filesystem), fall back to the public byte-proxy
 * endpoint — `<img>` tags can't send the tenant header, so the tenant is
 * passed as a query param instead (see tenant.middleware.ts).
 */
export function resolveLogoUrl(logoUrl: string | null, logoKey: string | null): string | null {
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
  receiptFooter: string | null;
  reportFooter: string | null;
  resultFooter: string | null;
  studentPrefix: string;
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
      phone: row.phone ?? base.school.phone,
      email: row.email ?? base.school.email,
      website: row.website ?? base.school.website,
      principalName: row.principalName ?? base.school.principalName,
      logoDataUrl: resolveLogoUrl(row.logoUrl, row.logoKey),
      currency: row.currency,
      timezone: row.timezone,
      language: row.language,
    },
    fees: {
      ...base.fees,
      receiptPrefix: row.receiptPrefix,
      currencySymbol: row.currency === "USD" ? "$" : row.currency,
      billingMode: row.billingMode ?? base.fees.billingMode,
      academicMonths: row.feeAcademicMonths ?? base.fees.academicMonths,
      billingStartMonth: row.feeBillingStartMonth ?? base.fees.billingStartMonth,
      billingEndMonth: row.feeBillingEndMonth ?? base.fees.billingEndMonth,
      allowPartialPayment: row.feeAllowPartial ?? base.fees.allowPartialPayment,
      allowAdvancePayment: row.feeAllowAdvance ?? base.fees.allowAdvancePayment,
      carryForward: row.feeCarryForward ?? base.fees.carryForward,
      monthSetupDay: row.feeMonthSetupDay ?? base.fees.monthSetupDay,
    },
    students: { ...base.students, idPrefix: row.studentPrefix },
    teachers: { ...base.teachers, idPrefix: row.teacherPrefix },
    parents: { ...base.parents, idPrefix: row.parentPrefix },
    branding: {
      ...base.branding,
      loginTitle: row.name,
      footerText: `© ${new Date().getFullYear()} ${row.name}. All rights reserved.`,
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
      phone: s.phone || null,
      email: s.email || null,
      website: s.website || null,
      principalName: s.principalName || null,
      currency: s.currency,
      timezone: s.timezone,
      language: s.language,
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
    };
  }
  if (key === "students") {
    return { studentPrefix: (section as SettingsState["students"]).idPrefix };
  }
  if (key === "teachers") {
    return { teacherPrefix: (section as SettingsState["teachers"]).idPrefix };
  }
  if (key === "parents") {
    return { parentPrefix: (section as SettingsState["parents"]).idPrefix };
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
  const row = await api<ApiSchool>("/settings", { method: "PATCH", body: patch });
  return mapApiSchoolToSettings(row);
}
