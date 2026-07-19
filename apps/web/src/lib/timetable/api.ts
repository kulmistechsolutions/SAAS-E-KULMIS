import { api } from "@/lib/api";
import type {
  AssignShiftInput,
  FeasibilityReport,
  SaveShiftInput,
  SaveSubjectLoadsInput,
  SaveTeacherUnavailabilityInput,
} from "@ekulmis/shared";

export interface ShiftPeriodDto {
  id: string;
  name: string;
  orderIndex: number;
  startMinute: number;
  endMinute: number;
  isBreak: boolean;
}

export interface ShiftDto {
  id: string;
  name: string;
  orderIndex: number;
  days: number[];
  status: string;
  periods: ShiftPeriodDto[];
}

export interface AllocationSubject {
  subjectId: string;
  subjectName: string;
  teacherId: string | null;
  teacherName: string | null;
  periodsPerWeek: number;
}

export interface AllocationRoom {
  classId: string;
  sectionId: string | null;
  label: string;
  shiftId: string | null;
  subjects: AllocationSubject[];
}

export interface UnavailabilityDto {
  id: string;
  teacherId: string;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  reason: string | null;
}

const q = encodeURIComponent;

export const fetchShifts = (academicYearId: string) =>
  api<ShiftDto[]>(`/timetable/shifts?academicYearId=${q(academicYearId)}`);

export const createShift = (body: SaveShiftInput) =>
  api<ShiftDto>("/timetable/shifts", { method: "POST", body });

export const updateShift = (id: string, body: SaveShiftInput) =>
  api<ShiftDto>(`/timetable/shifts/${id}`, { method: "PATCH", body });

export const deleteShift = (id: string) =>
  api<{ success: boolean }>(`/timetable/shifts/${id}`, { method: "DELETE" });

export const assignShift = (body: AssignShiftInput) =>
  api<{ success: boolean }>("/timetable/assign-shift", { method: "POST", body });

export const fetchAllocation = (academicYearId: string) =>
  api<{ rooms: AllocationRoom[] }>(
    `/timetable/allocation?academicYearId=${q(academicYearId)}`,
  );

export const saveAllocation = (body: SaveSubjectLoadsInput) =>
  api<{ success: boolean; saved: number }>("/timetable/allocation", {
    method: "PATCH",
    body,
  });

export const fetchUnavailability = () =>
  api<UnavailabilityDto[]>("/timetable/unavailability");

export const saveUnavailability = (body: SaveTeacherUnavailabilityInput) =>
  api<{ success: boolean; saved: number }>("/timetable/unavailability", {
    method: "PATCH",
    body,
  });

export const fetchFeasibility = (academicYearId: string) =>
  api<FeasibilityReport>(
    `/timetable/feasibility?academicYearId=${q(academicYearId)}`,
  );
