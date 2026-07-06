import { z } from "zod";
import { shiftSchema } from "./teacher";

export const AttendanceStatus = {
  PRESENT: "PRESENT",
  ABSENT: "ABSENT",
  LATE: "LATE",
  EXCUSED: "EXCUSED",
} as const;
export type AttendanceStatus =
  (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
export const attendanceStatusSchema = z.nativeEnum(AttendanceStatus);

const dateStr = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD");

/** Bulk-mark a section's students for a day (Module 5). */
export const markStudentAttendanceSchema = z.object({
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  date: dateStr,
  records: z
    .array(
      z.object({
        studentId: z.string().min(1),
        status: attendanceStatusSchema,
      }),
    )
    .min(1),
});
export type MarkStudentAttendanceInput = z.infer<
  typeof markStudentAttendanceSchema
>;

/** Bulk-mark a shift's teachers for a day (Module 6). */
export const markTeacherAttendanceSchema = z.object({
  shift: shiftSchema,
  date: dateStr,
  records: z
    .array(
      z.object({
        teacherId: z.string().min(1),
        status: attendanceStatusSchema,
      }),
    )
    .min(1),
});
export type MarkTeacherAttendanceInput = z.infer<
  typeof markTeacherAttendanceSchema
>;
