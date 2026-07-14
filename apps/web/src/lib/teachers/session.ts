"use client";

import { apiGetTeacherMe, type TeacherMe } from "./api";

let cache: TeacherMe | null = null;
let inflight: Promise<TeacherMe> | null = null;

/** Load the logged-in teacher's profile (cached for the session). */
export async function loadTeacherMe(force = false): Promise<TeacherMe> {
  if (!force && cache) return cache;
  if (!force && inflight) return inflight;
  inflight = apiGetTeacherMe()
    .then((me) => {
      cache = me;
      return me;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function getCachedTeacherMe(): TeacherMe | null {
  return cache;
}

export function clearTeacherMeCache(): void {
  cache = null;
  inflight = null;
}

export function teacherAssignedClassNames(me: TeacherMe): string[] {
  return [...new Set(me.assignments.map((a) => a.class.name))].sort();
}

export function teacherAssignedSectionNames(
  me: TeacherMe,
  className?: string,
): string[] {
  const rows = className
    ? me.assignments.filter((a) => a.class.name === className)
    : me.assignments;
  return [
    ...new Set(
      rows
        .map((a) => a.section?.name)
        .filter((n): n is string => Boolean(n)),
    ),
  ].sort();
}

export function teacherAssignedSubjectNames(
  me: TeacherMe,
  className?: string,
  sectionName?: string,
): string[] {
  return [
    ...new Set(
      me.assignments
        .filter((a) => {
          if (className && a.class.name !== className) return false;
          if (
            sectionName &&
            a.section &&
            a.section.name !== sectionName
          ) {
            return false;
          }
          return true;
        })
        .map((a) => a.subject.name),
    ),
  ].sort();
}
