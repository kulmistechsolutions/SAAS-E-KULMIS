"use client";

import { useSyncExternalStore } from "react";
import { ApiError, getAccessToken } from "@/lib/api";
import { activeAcademicYear as getActiveAcademicYear } from "@/lib/academics/store";
import { updateSecuritySettings } from "@/lib/users/store";
import {
  apiGetBranding,
  apiGetSettings,
  apiPatchSettings,
  apiRemoveSchoolLogo,
  apiUploadSchoolLogo,
  mapSettingsSectionToPatch,
} from "./api";
import { buildSettingsSeed } from "./seed";
import { validateSettings } from "./format";
import type {
  SettingsAuditAction,
  SettingsDashboardSummary,
  SettingsSectionKey,
  SettingsState,
} from "./types";

const EMPTY: SettingsState = buildSettingsSeed();

let state: SettingsState | null = null;
let loaded = false;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function setState(next: SettingsState) {
  state = next;
  emit();
}

/** Load school settings from the API (merges with local-only sections). */
export async function refreshSettings(): Promise<void> {
  // Public/unauthenticated pages (login screens, public results lookup) can't
  // call the staff-only /settings endpoint — fetch just the public branding
  // (name + logo) instead so they still show the real school, not the
  // generic product brand.
  if (!getAccessToken()) {
    try {
      const b = await apiGetBranding();
      const current = state ?? buildSettingsSeed();
      setState({
        ...current,
        school: {
          ...current.school,
          name: b.name,
          motto: b.motto ?? current.school.motto,
          logoDataUrl: b.logoUrl,
        },
      });
    } catch {
      /* keep cache */
    }
    return;
  }
  try {
    const remote = await apiGetSettings();
    const current = state ?? buildSettingsSeed();
    setState({
      ...remote,
      audit: current.audit,
      backups: current.backups,
      grades: current.grades,
      branding: { ...remote.branding, ...current.branding },
      academic: current.academic,
      examinations: current.examinations,
      salary: current.salary,
      expenses: current.expenses,
      attendance: current.attendance,
      quiz: current.quiz,
      notifications: current.notifications,
      email: current.email,
      security: current.security,
      backup: current.backup,
      license: current.license,
      system: current.system,
    });
  } catch {
    /* keep cache */
  }
}

function ensure(): SettingsState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  state = buildSettingsSeed();
  if (!loaded) {
    loaded = true;
    void refreshSettings();
  }
  return state;
}

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export function getSettings(): SettingsState {
  return ensure();
}

export function useSettingsState(): SettingsState {
  return useSyncExternalStore(subscribe, getSettings, () => EMPTY);
}

function clientIp(): string {
  return "127.0.0.1";
}

export function logSettingsAudit(
  action: SettingsAuditAction,
  user = "Admin User",
  role = "ADMINISTRATOR",
  detail?: string,
) {
  const s = ensure();
  const entry = {
    id: `sa_${Date.now()}`,
    action,
    user,
    role,
    detail,
    at: new Date().toISOString(),
    ipAddress: clientIp(),
  };
  setState({ ...s, audit: [entry, ...s.audit].slice(0, 300) });
}

const SECTION_AUDIT: Partial<Record<SettingsSectionKey, SettingsAuditAction>> = {
  school: "SCHOOL_UPDATED",
  branding: "BRANDING_CHANGED",
  academic: "ACADEMIC_UPDATED",
  fees: "FEE_UPDATED",
  examinations: "EXAM_UPDATED",
  security: "SECURITY_UPDATED",
  email: "SMTP_UPDATED",
};

const API_SECTIONS = new Set<SettingsSectionKey>([
  "school",
  "fees",
  "students",
  "teachers",
  "parents",
]);

export async function updateSettingsSection<K extends SettingsSectionKey>(
  key: K,
  patch: SettingsState[K],
  user = "Admin User",
  role = "ADMINISTRATOR",
): Promise<{ ok: boolean; error?: string }> {
  const s = ensure();
  const next = { ...s, [key]: patch };
  const err = validateSettings(next);
  if (err) return { ok: false, error: err };

  if (API_SECTIONS.has(key)) {
    const body = mapSettingsSectionToPatch(key, patch);
    if (body) {
      try {
        const remote = await apiPatchSettings(body);
        setState({
          ...next,
          school: remote.school,
          fees: remote.fees,
          students: remote.students,
          teachers: remote.teachers,
          parents: remote.parents,
          branding: { ...next.branding, ...remote.branding },
        });
      } catch (e) {
        return { ok: false, error: apiErr(e, "Failed to save settings.") };
      }
    } else {
      setState(next);
    }
  } else {
    setState(next);
  }

  if (key === "school" && patch && typeof patch === "object" && "logoDataUrl" in patch) {
    logSettingsAudit("LOGO_CHANGED", user, role);
  }
  const auditAction = SECTION_AUDIT[key];
  if (auditAction) logSettingsAudit(auditAction, user, role);

  if (key === "security") {
    const sec = patch as SettingsState["security"];
    updateSecuritySettings({
      minPasswordLength: sec.minPasswordLength,
      maxFailedLogins: sec.loginAttemptLimit,
      sessionTimeoutMinutes: sec.sessionTimeoutMinutes,
      requireUppercase: sec.requireUppercase,
      requireNumber: sec.requireNumber,
    });
  }

  return { ok: true };
}

/** Upload/replace the school logo immediately (not gated on Save Changes). */
export async function uploadSchoolLogo(
  file: string,
  mimeType: string,
): Promise<{ ok: boolean; logoUrl?: string | null; error?: string }> {
  try {
    const remote = await apiUploadSchoolLogo(file, mimeType);
    setState({ ...ensure(), school: remote.school });
    logSettingsAudit("LOGO_CHANGED");
    return { ok: true, logoUrl: remote.school.logoDataUrl };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to upload logo.") };
  }
}

export async function removeSchoolLogo(): Promise<{ ok: boolean; error?: string }> {
  try {
    const remote = await apiRemoveSchoolLogo();
    setState({ ...ensure(), school: remote.school });
    logSettingsAudit("LOGO_CHANGED");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: apiErr(e, "Failed to remove logo.") };
  }
}

export async function updateGrades(
  grades: SettingsState["grades"],
): Promise<{ ok: boolean; error?: string }> {
  return updateSettingsSection("grades", grades);
}

export function resetSettingsToDefault(): void {
  const seed = buildSettingsSeed();
  const s = ensure();
  setState({ ...seed, audit: s.audit, backups: s.backups });
  logSettingsAudit("SETTINGS_RESET");
}

export function settingsDashboard(): SettingsDashboardSummary {
  const s = ensure();
  const activeYear = getActiveAcademicYear();
  return {
    schoolName: s.school.name,
    activeAcademicYear: activeYear,
    parentPortalEnabled: s.parents.portalEnabled,
    studentPortalEnabled: s.students.portalLoginEnabled,
    lastBackupAt: s.backup.lastBackupAt,
    licenseActive: s.license.active,
    categoriesConfigured: 12,
  };
}

export function exportSettingsJson(): string {
  const s = ensure();
  const { audit: _a, backups: _b, ...exportable } = s;
  return JSON.stringify(exportable, null, 2);
}

export function importSettingsJson(
  json: string,
): { ok: boolean; error?: string } {
  try {
    const parsed = JSON.parse(json) as Partial<SettingsState>;
    const merged = {
      ...buildSettingsSeed(),
      ...parsed,
      audit: ensure().audit,
      backups: ensure().backups,
    };
    const err = validateSettings(merged);
    if (err) return { ok: false, error: err };
    setState(merged);
    logSettingsAudit("SETTINGS_IMPORTED");
    return { ok: true };
  } catch {
    return { ok: false, error: "Invalid configuration file." };
  }
}

export function createManualBackup(label?: string): { ok: boolean; id?: string } {
  const s = ensure();
  const id = `bk_${Date.now()}`;
  const backup = {
    id,
    label: label ?? `Manual backup ${new Date().toLocaleString()}`,
    createdAt: new Date().toISOString(),
    data: exportSettingsJson(),
  };
  setState({
    ...s,
    backups: [backup, ...s.backups].slice(0, 20),
    backup: { ...s.backup, lastBackupAt: backup.createdAt },
  });
  logSettingsAudit("BACKUP_CREATED", "Admin User", "ADMINISTRATOR", backup.label);
  return { ok: true, id };
}

export function restoreBackup(backupId: string): { ok: boolean; error?: string } {
  const s = ensure();
  const backup = s.backups.find((b) => b.id === backupId);
  if (!backup) return { ok: false, error: "Backup not found." };
  const result = importSettingsJson(backup.data);
  if (result.ok)
    logSettingsAudit("BACKUP_RESTORED", "Admin User", "ADMINISTRATOR", backup.label);
  return result;
}

export function sendTestEmail(): { ok: boolean; message: string } {
  const s = ensure();
  if (!s.email.smtpHost || !s.email.senderEmail) {
    return { ok: false, message: "Configure SMTP host and sender email first." };
  }
  logSettingsAudit("SMTP_UPDATED", "Admin User", "ADMINISTRATOR", "Test email sent");
  return { ok: true, message: `Test email queued to ${s.email.senderEmail} (demo mode).` };
}

export function schoolDisplayName(): string {
  return ensure().school.name;
}

export function schoolPrintHeader(): { name: string; logoUrl: string | null } {
  const s = ensure();
  return { name: s.school.name, logoUrl: s.school.logoDataUrl };
}

export function schoolLogoUrl(): string | null {
  return ensure().school.logoDataUrl;
}

export function schoolBranding() {
  const s = ensure();
  return {
    name: s.school.name,
    tagline: s.school.motto,
    pageTitle: `${s.school.name} — School Management ERP`,
    description: s.school.motto,
    loginTitle: s.branding.loginTitle,
    footerText: s.branding.footerText,
    primaryColor: s.branding.primaryColor,
    logoUrl: s.school.logoDataUrl,
    loginBackgroundUrl: s.branding.loginBackgroundDataUrl,
  };
}

/** Fetch public branding (login page) without auth. */
export async function loadPublicBranding(): Promise<ReturnType<typeof schoolBranding>> {
  try {
    const b = await apiGetBranding();
    return {
      name: b.name,
      tagline: b.motto ?? "",
      pageTitle: `${b.name} — School Management ERP`,
      description: b.motto ?? "",
      loginTitle: b.name,
      footerText: `© ${new Date().getFullYear()} ${b.name}. All rights reserved.`,
      primaryColor: "#3b82f6",
      logoUrl: b.logoUrl,
      loginBackgroundUrl: null,
    };
  } catch {
    return schoolBranding();
  }
}

export function getGradeBands() {
  return ensure().grades;
}

export function systemStorageUsageMb(): number {
  if (typeof window === "undefined") return 0;
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k) total += (localStorage.getItem(k)?.length ?? 0) * 2;
  }
  return Math.round((total / 1024 / 1024) * 100) / 100;
}

export function refreshServerTime(): void {
  const s = ensure();
  setState({
    ...s,
    system: { ...s.system, serverTime: new Date().toISOString() },
  });
}
