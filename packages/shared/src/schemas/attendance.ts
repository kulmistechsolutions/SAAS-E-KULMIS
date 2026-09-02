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

/** Record a disciplinary/behavior case (note) against a student. */
export const createStudentCaseSchema = z.object({
  studentId: z.string().min(1),
  classId: z.string().min(1),
  sectionId: z.string().min(1).nullable().optional(),
  title: z.string().trim().min(1).max(120),
  note: z.string().trim().max(2000).nullable().optional(),
  date: dateStr,
});
export type CreateStudentCaseInput = z.infer<typeof createStudentCaseSchema>;

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

/**
 * Where one attendance officer may take attendance.
 *
 * A null section means the whole class; a null shift means every shift. Both
 * widen rather than restrict, because schools assign "Grade 1, mornings"
 * rather than enumerating every section of it.
 */
export const attendanceAssignmentsSchema = z.object({
  userId: z.string().min(1),
  assignments: z
    .array(
      z.object({
        classId: z.string().min(1),
        sectionId: z.string().min(1).nullable().optional(),
        shiftId: z.string().min(1).nullable().optional(),
      }),
    )
    .max(500),
});
export type AttendanceAssignmentsInput = z.infer<typeof attendanceAssignmentsSchema>;
