export const money = (n: number) => `$${n.toLocaleString()}`;

export function shortDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

export function longDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export const genderLabel = (g: string) => (g === "MALE" ? "Male" : "Female");

export const shiftLabel = (s: string) =>
  s === "MORNING" ? "Morning" : s === "AFTERNOON" ? "Afternoon" : "Both";

/**
 * The shift label to show for one assignment row. A BOTH-shift teacher's
 * rows carry their own explicit shift; a single-shift teacher's rows leave
 * `shift` null and simply inherit their one profile shift. Only a legacy
 * BOTH-teacher row with no shift recorded falls through to "—".
 */
export const assignmentShiftLabel = (
  assignmentShift: string | null,
  teacherShift: string,
): string => {
  if (assignmentShift) return shiftLabel(assignmentShift);
  if (teacherShift === "MORNING" || teacherShift === "AFTERNOON") {
    return shiftLabel(teacherShift);
  }
  return "—";
};

export const statusLabel = (s: string) =>
  s.charAt(0) + s.slice(1).toLowerCase();

export function sectionLabel(section: string | null): string {
  return section ? `Section ${section}` : "All Sections";
}
