"use client";

import QRCode from "qrcode";
import { apiFetchStudentPhotoBlob } from "@/lib/students/api";
import { getSettings, schoolBranding } from "@/lib/settings/store";
import type { Student } from "@/lib/students/types";
import { darken } from "./templates";
import type {
  CardContext,
  CardLabels,
  CardTemplate,
  ClearanceMeta,
  CustomMeta,
  ExamCardMeta,
} from "./types";

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result));
    fr.onerror = () => reject(fr.error ?? new Error("Could not read image"));
    fr.readAsDataURL(blob);
  });
}

/**
 * Every image on a card is embedded as a data URL rather than linked.
 *
 * Two reasons, both learned the hard way: the student photo endpoint needs an
 * Authorization header, which a plain `<img src>` in a popup window cannot
 * send; and even for public images the print dialog can fire before a remote
 * image finishes loading, printing a blank box. Inlined bytes are always there
 * by the time the page paints.
 */
async function urlToDataUrl(url: string): Promise<string | null> {
  if (!url) return null;
  if (url.startsWith("data:")) return url;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await blobToDataUrl(await res.blob());
  } catch {
    return null;
  }
}

const photoCache = new Map<string, string | null>();

export async function studentPhotoDataUrl(studentId: string): Promise<string | null> {
  if (photoCache.has(studentId)) return photoCache.get(studentId) ?? null;
  let out: string | null = null;
  try {
    out = await blobToDataUrl(await apiFetchStudentPhotoBlob(studentId));
  } catch {
    out = null;
  }
  photoCache.set(studentId, out);
  return out;
}

/** Drop cached photos so a freshly uploaded picture is picked up. */
export function clearPhotoCache() {
  photoCache.clear();
}

let logoCache: { src: string; data: string | null } | null = null;

async function schoolLogoDataUrl(): Promise<string | null> {
  const src = schoolBranding().logoUrl ?? "";
  if (!src) return null;
  if (logoCache && logoCache.src === src) return logoCache.data;
  const data = await urlToDataUrl(src);
  logoCache = { src, data };
  return data;
}

/**
 * QR payload is the permanent Student ID and nothing else.
 *
 * PRD §12 is explicit that scanning must not leak private student information,
 * so the code carries the same identifier already printed on the face of the
 * card — a scanner reveals nothing a person holding the card cannot already
 * read.
 */
export async function makeQrDataUrl(text: string, accent: string): Promise<string | null> {
  if (!text) return null;
  try {
    return await QRCode.toDataURL(text, {
      errorCorrectionLevel: "M",
      margin: 0,
      width: 240,
      color: { dark: darken(accent, 0.35), light: "#ffffff" },
    });
  } catch {
    return null;
  }
}

export interface BuildContextOptions {
  template: CardTemplate;
  labels: CardLabels;
  accent: string;
  includePhotos: boolean;
  includeQr: boolean;
  exam?: ExamCardMeta;
  clearance?: ClearanceMeta;
  custom?: CustomMeta;
  /** Guardian name/phone by student id, when the caller has them loaded. */
  guardians?: Map<string, { name: string; phone: string }>;
}

/**
 * Turn student records into render-ready card contexts.
 *
 * `studentId` is assigned from `student.code` here and nowhere else in the
 * module — the generator reads the permanent ID, it never mints or edits one
 * (PRD §7). Nothing on this path writes back to the student record.
 */
export async function buildCardContexts(
  students: Student[],
  opts: BuildContextOptions,
): Promise<CardContext[]> {
  const school = getSettings().school;
  const branding = schoolBranding();
  const logoDataUrl = await schoolLogoDataUrl();
  const accent = opts.accent || opts.template.accent;
  const issueDate = new Date().toLocaleDateString();

  const needsPhoto = opts.includePhotos && opts.template.usesPhoto;
  const photos = new Map<string, string | null>();
  if (needsPhoto) {
    // Sequential on purpose: a class of 40 students would otherwise open 40
    // parallel authenticated image requests and the API pool is the bottleneck.
    for (const s of students) {
      photos.set(s.id, s.hasPhoto ? await studentPhotoDataUrl(s.id) : null);
    }
  }

  const out: CardContext[] = [];
  for (const s of students) {
    const guardian = opts.guardians?.get(s.id);
    out.push({
      studentId: s.code,
      studentName: s.fullName,
      className: s.className || "—",
      section: s.section || "—",
      academicYear: s.academicYear || school.academicYear || "—",
      gender: s.gender,
      dob: s.dob ?? "—",
      photoDataUrl: photos.get(s.id) ?? null,
      guardianName: guardian?.name ?? "",
      guardianPhone: guardian?.phone ?? "",

      schoolName: school.name || branding.name,
      schoolMotto: school.motto || "",
      schoolAddress: school.address || "",
      schoolPhone: school.phone || "",
      schoolEmail: school.email || "",
      schoolWebsite: school.website || "",
      logoDataUrl,
      principalName: school.principalName || "",

      accent,
      cardTitle: opts.labels.cardTitle,
      idLabel: opts.labels.idLabel,
      footerText: opts.labels.footerText,
      issueDate,
      qrDataUrl: opts.includeQr ? await makeQrDataUrl(s.code, accent) : null,

      examName: opts.exam?.examName ?? "",
      examDate: opts.exam?.examDate ?? "",
      examSession: opts.exam?.examSession ?? "",
      examOffice: opts.exam?.examOffice ?? "",
      clearanceStatus: opts.clearance?.status ?? "",
      customLine1: opts.custom?.line1 ?? "",
      customLine2: opts.custom?.line2 ?? "",
    });
  }
  return out;
}

/** Students selected for printing that have no photo on file (PRD §11). */
export function studentsMissingPhotos(students: Student[]): Student[] {
  return students.filter((s) => !s.hasPhoto);
}
