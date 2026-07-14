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
