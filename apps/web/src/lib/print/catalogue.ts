import type { PaperSize } from "@/lib/print/paper";

/**
 * Every kind of document this system prints, in one list.
 *
 * This is the register the PRD asks for: a new printable feature adds an entry
 * here and Settings grows a row for it, rather than each module inventing its
 * own design page. Nothing else in the system should carry a second list of
 * document types.
 *
 * A template id names a layout the code already contains. Nothing stored
 * against a school is ever executed or interpreted as markup — choosing a
 * design picks between layouts that already exist, it does not describe one,
 * which is what keeps a school's settings from becoming a place to inject
 * anything.
 */

export type DocCategory =
  | "STUDENTS"
  | "TEACHERS"
  | "PARENTS"
  | "FINANCE"
  | "EXAMS";

export const CATEGORY_LABEL: Record<DocCategory, string> = {
  STUDENTS: "Students",
  TEACHERS: "Teachers",
  PARENTS: "Parents",
  FINANCE: "Finance",
  EXAMS: "Exams",
};

export interface DocTemplateOption {
  id: string;
  label: string;
  note: string;
}

export interface DocTypeDef {
  /** Stable identifier. Stored against the school; never shown to anyone. */
  id: string;
  category: DocCategory;
  /** What an administrator calls it. */
  label: string;
  /** What it is for, in one line. */
  note: string;
  /** Where in the system this document is actually printed from. */
  printedFrom: string;
  templates: DocTemplateOption[];
  defaultTemplate: string;
  defaultPaper: PaperSize;
  defaultLandscape?: boolean;
}

/** The four letter designs the document engine renders. */
const LETTER_DESIGNS: DocTemplateOption[] = [
  { id: "MODERN", label: "Official Letter (Modern)", note: "Coloured section bands" },
  { id: "SIMPLE", label: "Simple Letter", note: "Grey headings, plain rules" },
  { id: "ELEGANT", label: "Elegant Letter", note: "Rules only, wide letter-spacing" },
  { id: "MINIMAL", label: "Minimal Letter", note: "No boxes, no photo" },
];

/** The two designs the money documents and result cards render. */
const CLASSIC_PREMIUM: DocTemplateOption[] = [
  { id: "PREMIUM", label: "Premium", note: "Full letterhead, watermark, stamp" },
  { id: "CLASSIC", label: "Classic", note: "Plain header, compact rows" },
];

export const DOC_TYPES: DocTypeDef[] = [
  {
    id: "STUDENT_PROFILE",
    category: "STUDENTS",
    label: "Student Information",
    note: "Everything on a student's record, on one sheet.",
    printedFrom: "Students → the print icon on a student's row",
    templates: LETTER_DESIGNS,
    defaultTemplate: "MODERN",
    defaultPaper: "A4",
  },
  {
    id: "TEACHER_PROFILE",
    category: "TEACHERS",
    label: "Teacher Information",
    note: "A teacher's record, on one sheet.",
    printedFrom: "Teachers → the print icon on a teacher's row",
    templates: LETTER_DESIGNS,
    defaultTemplate: "MODERN",
    defaultPaper: "A4",
  },
  {
    id: "PARENT_PROFILE",
    category: "PARENTS",
    label: "Parent Information",
    note: "A guardian and the children linked to them.",
    printedFrom: "Parents → the print icon on a guardian's row",
    templates: LETTER_DESIGNS,
    defaultTemplate: "MODERN",
    defaultPaper: "A4",
  },
  {
    id: "FEE_RECEIPT",
    category: "FINANCE",
    label: "Fee Receipt",
    note: "Given to a family the moment money is taken.",
    printedFrom: "Finance → Collect Fees, and every receipt reprint",
    templates: CLASSIC_PREMIUM,
    defaultTemplate: "PREMIUM",
    defaultPaper: "A4",
  },
  {
    id: "FEE_INVOICE",
    category: "FINANCE",
    label: "Fee Invoice",
    note: "What a family owes, and by when.",
    printedFrom: "Finance → Student account",
    templates: CLASSIC_PREMIUM,
    defaultTemplate: "PREMIUM",
    defaultPaper: "A4",
  },
  {
    id: "EXAM_RESULT_CARD",
    category: "EXAMS",
    label: "Exam Result Card",
    note: "A student's marks for one examination.",
    printedFrom: "Examinations → Results",
    templates: CLASSIC_PREMIUM,
    defaultTemplate: "PREMIUM",
    defaultPaper: "A4",
  },
];

export function docType(id: string): DocTypeDef | undefined {
  return DOC_TYPES.find((d) => d.id === id);
}

/** Every category that actually has documents, in display order. */
export const CATEGORIES: DocCategory[] = [
  "STUDENTS",
  "TEACHERS",
  "PARENTS",
  "FINANCE",
  "EXAMS",
];
