"use client";

import { api } from "@/lib/api";

export interface ExamRoom {
  id: string;
  name: string;
  building: string | null;
  rows: number;
  cols: number;
  notes: string | null;
}

export interface TimetableEntry {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  subject: string;
  classNames: string[];
  roomIds: string[];
  note?: string;
}

export interface SeatingPlan {
  classNames: string[];
  roomIds: string[];
  generatedAt: string;
  rooms: { roomId: string; seats: (string | null)[][] }[];
}

export interface ExamTimetable {
  id: string;
  name: string;
  academicYear: string;
  entries: TimetableEntry[];
  seating: SeatingPlan | null;
  createdAt: string;
  updatedAt: string;
}

export type RoomInput = Omit<ExamRoom, "id">;

export const apiRooms = () => api<ExamRoom[]>("/exam-schedule/rooms");
export const apiCreateRoom = (body: RoomInput) => api<ExamRoom>("/exam-schedule/rooms", { method: "POST", body });
export const apiUpdateRoom = (id: string, body: RoomInput) =>
  api<ExamRoom>(`/exam-schedule/rooms/${id}`, { method: "PATCH", body });
export const apiDeleteRoom = (id: string) => api<{ success: boolean }>(`/exam-schedule/rooms/${id}`, { method: "DELETE" });

export const apiTimetables = () => api<ExamTimetable[]>("/exam-schedule/timetables");
export const apiCreateTimetable = (body: { name: string; academicYear: string; entries?: TimetableEntry[] }) =>
  api<ExamTimetable>("/exam-schedule/timetables", { method: "POST", body });
export const apiUpdateTimetable = (
  id: string,
  body: Partial<{ name: string; academicYear: string; entries: TimetableEntry[]; seating: SeatingPlan | null }>,
) => api<ExamTimetable>(`/exam-schedule/timetables/${id}`, { method: "PATCH", body });
export const apiDeleteTimetable = (id: string) =>
  api<{ success: boolean }>(`/exam-schedule/timetables/${id}`, { method: "DELETE" });
