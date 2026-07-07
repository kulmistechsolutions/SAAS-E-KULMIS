import type { GradeBand, SettingsState } from "./types";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_RE = /^[+]?[\d\s()-]{7,20}$/;

export function isValidEmail(value: string): boolean {
  return EMAIL_RE.test(value.trim());
}

export function isValidPhone(value: string): boolean {
  if (!value.trim()) return true;
  return PHONE_RE.test(value.trim());
}

export function validateGradeBands(bands: GradeBand[]): string | null {
  if (bands.length === 0) return "At least one grade band is required.";
  const sorted = [...bands].sort((a, b) => b.min - a.min);
  for (const b of sorted) {
    if (b.min < 0 || b.max > 100 || b.min > b.max)
      return `Invalid range for grade ${b.grade}.`;
    if (!b.grade.trim()) return "Grade label cannot be empty.";
  }
  for (let i = 0; i < sorted.length - 1; i++) {
    if (sorted[i].min <= sorted[i + 1].max)
      return "Grade ranges must not overlap.";
  }
  return null;
}

export function validatePrefixes(state: SettingsState): string | null {
  const prefixes = [
    state.students.idPrefix,
    state.teachers.idPrefix,
    state.parents.idPrefix,
  ].map((p) => p.trim().toUpperCase());
  const unique = new Set(prefixes);
  if (unique.size !== prefixes.length)
    return "Student, teacher, and parent ID prefixes must be unique.";
  return null;
}

export function validateSettings(state: SettingsState): string | null {
  if (!state.school.name.trim()) return "School name is required.";
  if (!isValidEmail(state.school.email)) return "Invalid school email address.";
  if (!isValidPhone(state.school.phone)) return "Invalid school phone number.";
  if (!isValidEmail(state.email.senderEmail) && state.email.senderEmail)
    return "Invalid sender email address.";
  const gradeErr = validateGradeBands(state.grades);
  if (gradeErr) return gradeErr;
  const prefixErr = validatePrefixes(state);
  if (prefixErr) return prefixErr;
  if (state.fees.monthSetupDay < 1 || state.fees.monthSetupDay > 28)
    return "Month setup day must be between 1 and 28.";
  if (state.security.minPasswordLength < 6)
    return "Minimum password length must be at least 6.";
  return null;
}

/** Convert #RRGGBB to Tailwind HSL channel string e.g. "221 83% 53%". */
export function hexToHslChannels(hex: string): string | null {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return null;
  const r = parseInt(raw.slice(0, 2), 16) / 255;
  const g = parseInt(raw.slice(2, 4), 16) / 255;
  const b = parseInt(raw.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
    }
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

export function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const allowed = ["image/png", "image/jpeg", "image/webp", "image/svg+xml"];
    if (!allowed.includes(file.type)) {
      reject(new Error("Unsupported logo format. Use PNG, JPG, WebP, or SVG."));
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      reject(new Error("Logo must be under 2 MB."));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Failed to read file."));
    reader.readAsDataURL(file);
  });
}
