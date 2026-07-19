import { api, API_URL, ApiError, getAccessToken, TENANT } from "@/lib/api";
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

// ── Generated timetables ───────────────────────────────────────────────────

export interface TimetableSummary {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  generatedAt: string | null;
  notes: string | null;
  shift: { id: string; name: string };
  _count: { entries: number };
}

export interface TimetableEntryDto {
  id: string;
  classId: string;
  sectionId: string | null;
  dayOfWeek: number;
  startMinute: number;
  endMinute: number;
  shiftPeriodId: string;
  subject: { id: string; name: string };
  teacher: { id: string; fullName: string } | null;
  class: { id: string; name: string };
  section: { id: string; name: string } | null;
}

export interface TimetableDetail {
  id: string;
  name: string;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  notes: string | null;
  shift: ShiftDto;
  entries: TimetableEntryDto[];
}

export const fetchTimetables = (academicYearId: string) =>
  api<TimetableSummary[]>(
    `/timetable/generated?academicYearId=${q(academicYearId)}`,
  );

export const fetchTimetable = (id: string) =>
  api<TimetableDetail>(`/timetable/generated/${id}`);

export const generateTimetable = (academicYearId: string, shiftId: string) =>
  api<{ timetableId: string; lessons: number; notes: string[] }>(
    "/timetable/generate",
    { method: "POST", body: { academicYearId, shiftId } },
  );

export const publishTimetable = (id: string) =>
  api<{ success: boolean }>(`/timetable/generated/${id}/publish`, {
    method: "POST",
  });

export const deleteTimetable = (id: string) =>
  api<{ success: boolean }>(`/timetable/generated/${id}`, { method: "DELETE" });

/**
 * Downloads the printable timetable.
 *
 * A plain <a href> would 401: the endpoint needs a bearer token and an anchor
 * cannot send one. So fetch it as a blob and hand the browser an object URL.
 */
export async function downloadTimetablePdf(id: string, filename: string) {
  const token = getAccessToken();
  const res = await fetch(`${API_URL}/api/timetable/generated/${id}/pdf`, {
    headers: {
      "x-tenant-subdomain": TENANT,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });
  if (!res.ok) throw new ApiError(res.status, "Could not build the PDF.");
  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
