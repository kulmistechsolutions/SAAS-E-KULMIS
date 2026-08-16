"use client";

/**
 * ID Generator & Card Printing — shared types.
 *
 * The one rule that governs this whole module: the Student ID is READ here and
 * never written. `CardContext.studentId` is always `Student.code`, the
 * permanent identifier already stored on the student record. Templates may
 * relabel it ("STUDENT ID" → "ID NO"), but nothing in this module can change
 * the value itself — see `buildCardContext`, which is the only place it is set.
 */

export type CardType = "STUDENT_ID" | "EXAM_CARD" | "CLEARANCE_CARD" | "CUSTOM_CARD";

export type CardOrientation = "PORTRAIT" | "LANDSCAPE";

export const CARD_TYPES: { id: CardType; label: string; description: string }[] = [
  { id: "STUDENT_ID", label: "Student ID", description: "General student identification card." },
  { id: "EXAM_CARD", label: "Exam Card", description: "Examination entry card with exam details." },
  { id: "CLEARANCE_CARD", label: "Clearance Card", description: "Clearance status for fees, library and property." },
  { id: "CUSTOM_CARD", label: "Custom Card", description: "Library, transport, hostel, event or access card." },
];

/**
 * Everything a template may print. Values are resolved once per student by
 * `buildCardContext` so a template is a pure function of its context — that is
 * what makes the same card render identically in the preview, the print sheet
 * and the PDF.
 */
export interface CardContext {
  // ── Student (read-only, straight from the student record) ──
  /** Student.code — the PERMANENT student ID. Never generated or edited here. */
  studentId: string;
  studentName: string;
  className: string;
  section: string;
  academicYear: string;
  gender: string;
  dob: string;
  photoDataUrl: string | null;
  guardianName: string;
  guardianPhone: string;

  // ── School branding (from Settings, applied automatically) ──
  schoolName: string;
  schoolMotto: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  schoolWebsite: string;
  logoDataUrl: string | null;
  principalName: string;

  // ── Card presentation (admin-editable labels, never values) ──
  accent: string;
  cardTitle: string;
  idLabel: string;
  footerText: string;
  issueDate: string;
  qrDataUrl: string | null;

  // ── Card-type specific ──
  examName: string;
  examDate: string;
  examSession: string;
  examOffice: string;
  clearanceStatus: string;
  customLine1: string;
  customLine2: string;
}

export interface CardTemplate {
  id: string;
  name: string;
  cardType: CardType;
  orientation: CardOrientation;
  /** Template has a dedicated photo frame; without a photo it prints a placeholder. */
  usesPhoto: boolean;
  /** Default accent colour; overridden by the school's brand colour when set. */
  accent: string;
  /** Renders the INNER html of one card. The fixed-size wrapper is added by the layout engine. */
  render: (c: CardContext) => string;
}

/** Physical card sizes, in millimetres. */
export interface CardSize {
  id: string;
  label: string;
  /** Width/height of the card in its LANDSCAPE form; portrait swaps them. */
  width: number;
  height: number;
}

export const CARD_SIZES: CardSize[] = [
  { id: "STANDARD", label: "Standard ID (86 × 54 mm)", width: 86, height: 54 },
  { id: "CREDIT", label: "Credit Card (85.6 × 53.98 mm)", width: 85.6, height: 53.98 },
  { id: "LARGE", label: "Large (95 × 60 mm)", width: 95, height: 60 },
];

/** How a sheet of cards is laid out on paper. */
export interface PrintLayoutSettings {
  cardsPerPage: number;
  orientation: CardOrientation;
  sizeId: string;
  /** Custom size, used when sizeId === "CUSTOM". */
  customWidth: number;
  customHeight: number;
  /** Millimetres of blank space between cards, so they can be physically cut apart. */
  gap: number;
  /** Page margin in millimetres. */
  margin: number;
  showCutLines: boolean;
  showCardBorder: boolean;
}

export const DEFAULT_LAYOUT: PrintLayoutSettings = {
  cardsPerPage: 8,
  orientation: "PORTRAIT",
  sizeId: "STANDARD",
  customWidth: 86,
  customHeight: 54,
  gap: 6,
  margin: 10,
  showCutLines: true,
  showCardBorder: true,
};

/** Admin-editable label overrides. The ID VALUE is deliberately absent. */
export interface CardLabels {
  cardTitle: string;
  idLabel: string;
  footerText: string;
}

export interface ExamCardMeta {
  examName: string;
  examDate: string;
  examSession: string;
  examOffice: string;
}

export interface ClearanceMeta {
  status: string;
}

export interface CustomMeta {
  line1: string;
  line2: string;
}
