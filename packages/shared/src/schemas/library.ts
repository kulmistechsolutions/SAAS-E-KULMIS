import { z } from "zod";

/** Library (Module 16) — book catalogue + student loans. */

export const createBookSchema = z.object({
  title: z.string().min(1, "Title is required"),
  author: z.string().min(1).nullable().optional(),
  isbn: z.string().min(1).nullable().optional(),
  category: z.string().min(1).nullable().optional(),
  totalCopies: z.coerce.number().int().min(1).default(1),
});
export type CreateBookInput = z.infer<typeof createBookSchema>;

export const updateBookSchema = z.object({
  title: z.string().min(1).optional(),
  author: z.string().min(1).nullable().optional(),
  isbn: z.string().min(1).nullable().optional(),
  category: z.string().min(1).nullable().optional(),
  totalCopies: z.coerce.number().int().min(1).optional(),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateBookInput = z.infer<typeof updateBookSchema>;

export const issueBookSchema = z.object({
  bookId: z.string().min(1),
  studentId: z.string().min(1),
  dueDate: z.coerce.date(),
});
export type IssueBookInput = z.infer<typeof issueBookSchema>;

export const returnBookSchema = z.object({
  loanId: z.string().min(1),
});
export type ReturnBookInput = z.infer<typeof returnBookSchema>;

// ── Library PDF documents (books/notes students read in the portal) ─────────
// The file itself is sent as multipart, so these fields arrive as form strings —
// hence z.coerce for the boolean and the "" -> null normalisation.

const optionalText = z
  .string()
  .trim()
  .max(500)
  .optional()
  .transform((v) => (v ? v : null))
  .nullable();

/**
 * Multipart sends booleans as the strings "true"/"false". z.coerce.boolean()
 * is wrong here — it runs Boolean("false"), which is `true`.
 */
const formBoolean = z.union([z.boolean(), z.string()]);

export const createLibraryDocumentSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(200),
  description: optionalText,
  author: optionalText,
  /** Empty/absent = every class in the school may read it. */
  classId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .nullable(),
  allowDownload: formBoolean
    .optional()
    .transform((v) => v === true || v === "true"),
});
export type CreateLibraryDocumentInput = z.infer<
  typeof createLibraryDocumentSchema
>;

export const updateLibraryDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  description: optionalText,
  author: optionalText,
  classId: z
    .string()
    .trim()
    .optional()
    .transform((v) => (v ? v : null))
    .nullable(),
  allowDownload: formBoolean
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === "true")),
  status: z.enum(["ACTIVE", "INACTIVE"]).optional(),
});
export type UpdateLibraryDocumentInput = z.infer<
  typeof updateLibraryDocumentSchema
>;
