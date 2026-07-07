import {
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  DEFAULT_SALARY,
  SECTIONS,
  SUBJECTS,
  generatePassword,
  teacherCode,
} from "./constants";
import type { Teacher, TeacherAssignment, TeachersState } from "./types";

const FIRST_M = [
  "Ahmed", "Mohamed", "Ali", "Omar", "Yusuf", "Ibrahim", "Hassan", "Abdi",
  "Khalid", "Bilal", "Zakaria", "Musa", "Idris", "James", "Daniel", "Michael",
];
const FIRST_F = [
  "Amina", "Fatima", "Hodan", "Sagal", "Layla", "Maryan", "Ikran", "Nasro",
  "Khadija", "Zahra", "Sarah", "Emma", "Olivia", "Sophia", "Grace", "Hannah",
];
const LAST = [
  "Abdullahi", "Hassan", "Warsame", "Farah", "Ismail", "Omar", "Jama",
  "Mohamud", "Aden", "Ali", "Yusuf", "Smith", "Johnson", "Khan", "Ahmed",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function rand(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dateMonthsAgo(months: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  d.setDate(Math.min(day, 28));
  return d.toISOString();
}

export function buildSeed(): TeachersState {
  const teachers: Teacher[] = [];
  const assignments: TeacherAssignment[] = [];
  const TOTAL = 48;
  let teacherSeq = 0;
  let assignId = 0;

  for (let i = 1; i <= TOTAL; i++) {
    teacherSeq += 1;
    const isFemale = rand(i * 1.9) > 0.5;
    const first = isFemale ? pick(FIRST_F, i) : pick(FIRST_M, i);
    const last = pick(LAST, i * 3);
    const fullName = `${first} ${last}`;
    const shift = rand(i * 2.1) > 0.48 ? "MORNING" : "AFTERNOON";
    const status = rand(i * 4.3) > 0.92 ? "INACTIVE" : "ACTIVE";
    const code = teacherCode(teacherSeq);
    const phone = `+2526${String(3000000 + i * 173).slice(0, 7)}`;

    teachers.push({
      id: `t_${teacherSeq}`,
      code,
      fullName,
      gender: isFemale ? "FEMALE" : "MALE",
      phone,
      email: rand(i * 5.2) > 0.35 ? `${first.toLowerCase()}.${last.toLowerCase()}@edusmart.edu` : null,
      address: rand(i * 6.1) > 0.5 ? `${10 + (i % 40)} Main Street, Mogadishu` : null,
      qualification:
        rand(i * 7.3) > 0.3
          ? pick(["B.Ed", "M.Ed", "B.Sc Education", "Diploma in Education"], i)
          : null,
      salary: DEFAULT_SALARY + Math.floor(rand(i * 8.4) * 8) * 25,
      shift,
      status,
      registrationDate: dateMonthsAgo(Math.floor(rand(i) * 18), (i % 27) + 1),
      username: code,
      password: generatePassword(),
    });
  }

  // Assign ~85% of teachers; leave some without assignments.
  teachers.forEach((t, idx) => {
    if (rand(idx * 11.7) < 0.15) return;
    const count = rand(idx * 3.3) > 0.7 ? 3 : rand(idx * 2.8) > 0.45 ? 2 : 1;
    for (let a = 0; a < count; a++) {
      assignId += 1;
      const className = pick(CLASSES, idx + a * 2);
      const allSections = rand(assignId * 1.5) > 0.75;
      assignments.push({
        id: `a_${assignId}`,
        teacherId: t.id,
        academicYear: ACTIVE_ACADEMIC_YEAR,
        className,
        section: allSections ? null : pick(SECTIONS, assignId),
        subject: pick(SUBJECTS, idx + a),
        status: "ACTIVE",
      });
    }
  });

  return { teachers, assignments, teacherSeq };
}
