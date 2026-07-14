import { z } from "zod";

export const promotionTypeSchema = z.enum(["INDIVIDUAL", "CLASS", "SCHOOL_WIDE"]);

export const promoteStudentSchema = z.object({
  studentId: z.string().min(1),
  academicYearId: z.string().min(1),
  toClassId: z.string().optional().nullable(),
  toSectionId: z.string().optional().nullable(),
  graduate: z.boolean().default(false),
});

export type PromoteStudentInput = z.infer<typeof promoteStudentSchema>;

export const promoteClassSchema = z.object({
  academicYearId: z.string().min(1),
  fromClassId: z.string().min(1),
  fromSectionId: z.string().optional().nullable(),
  toClassId: z.string().optional().nullable(),
  toSectionId: z.string().optional().nullable(),
  graduate: z.boolean().default(false),
});

export type PromoteClassInput = z.infer<typeof promoteClassSchema>;

export const promoteSchoolWideSchema = z.object({
  academicYearId: z.string().min(1),
  graduate: z.boolean().default(false),
});

export type PromoteSchoolWideInput = z.infer<typeof promoteSchoolWideSchema>;
