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
  /** Which AttendanceShift this attendance was taken in — null for schools with no shifts set up. */
  shiftId: z.string().min(1).nullable().optional(),
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

const timeStr = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Time must be HH:mm")
  .nullable()
  .optional();

/** Create/update a standalone attendance shift (e.g. "Morning", "Afternoon"). */
export const saveAttendanceShiftSchema = z.object({
  name: z.string().trim().min(1).max(60),
  startTime: timeStr,
  endTime: timeStr,
});
export type SaveAttendanceShiftInput = z.infer<
  typeof saveAttendanceShiftSchema
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
