import {
  ACADEMIC_YEARS,
  ACTIVE_ACADEMIC_YEAR,
  CLASSES,
  DEFAULT_MONTHLY_FEE,
  SECTIONS,
  STUDENT_PREFIX,
  code,
} from "./constants";
import { buildParent } from "./parent-utils";
import type { Parent, Student, StudentsState } from "./types";

const FIRST_M = [
  "Ahmed", "Mohamed", "Ali", "Omar", "Yusuf", "Ibrahim", "Hassan", "Abdi",
  "Khalid", "Bilal", "Zakaria", "Musa", "Idris", "Nuur", "Farah", "Said",
  "James", "Daniel", "Michael", "David", "John", "Samuel", "Ethan", "Noah",
];
const FIRST_F = [
  "Amina", "Fatima", "Hodan", "Sagal", "Layla", "Maryan", "Ikran", "Nasro",
  "Khadija", "Zahra", "Ayaan", "Ruweyda", "Halima", "Sumaya", "Deqa", "Ubax",
  "Sarah", "Emma", "Olivia", "Sophia", "Grace", "Hannah", "Aisha", "Maya",
];
const LAST = [
  "Abdullahi", "Hassan", "Warsame", "Farah", "Ismail", "Omar", "Jama",
  "Mohamud", "Aden", "Ali", "Yusuf", "Nur", "Hussein", "Osman", "Barre",
  "Smith", "Johnson", "Brown", "Khan", "Ahmed", "Diriye", "Elmi", "Gedi",
];

function pick<T>(arr: readonly T[], i: number): T {
  return arr[i % arr.length];
}

function randInt(seed: number): number {
  const x = Math.sin(seed) * 10000;
  return x - Math.floor(x);
}

function dateInPastMonths(monthsBack: number, day: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - monthsBack);
  d.setDate(Math.min(day, 28));
  return d.toISOString();
}

/** Builds a deterministic demo dataset so the module works out of the box. */
export function buildSeed(): StudentsState {
  const students: Student[] = [];
  const parents: Parent[] = [];
  let studentSeq = 0;
  let parentSeq = 0;

  const TOTAL = 138;
  let s = 0;

  while (s < TOTAL) {
    // Create a parent, sometimes with 1-3 children (siblings).
    parentSeq += 1;
    const r = randInt(parentSeq * 3.1);
    const childCount = r > 0.82 ? 3 : r > 0.62 ? 2 : 1;

    const pLastIdx = parentSeq;
    const parentLast = pick(LAST, pLastIdx);
    const parentFirst = pick(FIRST_M, parentSeq * 2);
    const parentName = `${parentFirst} ${parentLast}`;
    const taken = parents.map((p) => p.username);
    const parent: Parent = buildParent(
      parentName,
      `+2526${String(1000000 + parentSeq * 137).slice(0, 7)}`,
      parentSeq,
      taken,
      {
        id: `p_${parentSeq}`,
        registrationDate: dateInPastMonths(Math.floor(randInt(parentSeq) * 14) + 1, (parentSeq % 27) + 1),
        altPhone:
          randInt(parentSeq * 8.2) > 0.65
            ? `+2526${String(5000000 + parentSeq * 91).slice(0, 7)}`
            : null,
        email:
          randInt(parentSeq * 9.1) > 0.4
            ? `${parentFirst.toLowerCase()}.${parentLast.toLowerCase()}@email.com`
            : null,
        address:
          randInt(parentSeq * 10.3) > 0.45
            ? `${5 + (parentSeq % 50)} Hodan Street, Mogadishu`
            : null,
        occupation:
          randInt(parentSeq * 11.5) > 0.35
            ? pick(["Business", "Teacher", "Engineer", "Nurse", "Trader"], parentSeq)
            : null,
        status: randInt(parentSeq * 12.7) > 0.94 ? "INACTIVE" : "ACTIVE",
      },
    );
    parents.push(parent);

    for (let c = 0; c < childCount && s < TOTAL; c++) {
      studentSeq += 1;
      s += 1;

      const isFemale = randInt(studentSeq * 1.7) > 0.5;
      const first = isFemale
        ? pick(FIRST_F, studentSeq)
        : pick(FIRST_M, studentSeq);
      const fullName = `${first} ${parentLast}`;

      const classIdx = Math.floor(randInt(studentSeq * 2.3) * CLASSES.length);
      const className = CLASSES[Math.min(classIdx, CLASSES.length - 1)];
      const section = pick(SECTIONS, studentSeq + c);

      const statusRoll = randInt(studentSeq * 4.9);
      const status =
        statusRoll > 0.93
          ? "GRADUATED"
          : statusRoll > 0.85
            ? "INACTIVE"
            : "ACTIVE";

      // Spread registration dates; ~8 this month.
      const monthsBack = studentSeq <= 8 ? 0 : Math.floor(randInt(studentSeq) * 11) + 1;
      const day = Math.floor(randInt(studentSeq * 5.5) * 27) + 1;

      const feeVariance = Math.floor(randInt(studentSeq * 6.2) * 6) * 10;

      students.push({
        id: `s_${studentSeq}`,
        code: code(STUDENT_PREFIX, studentSeq),
        fullName,
        gender: isFemale ? "FEMALE" : "MALE",
        dob: dateInPastMonths(12 * (5 + classIdx), day),
        phone:
          randInt(studentSeq * 7.1) > 0.7
            ? `+2526${String(2000000 + studentSeq * 91).slice(0, 7)}`
            : null,
        parentId: parent.id,
        className,
        section,
        monthlyFee: DEFAULT_MONTHLY_FEE + feeVariance,
        academicYear:
          status === "GRADUATED"
            ? pick(ACADEMIC_YEARS, 1)
            : ACTIVE_ACADEMIC_YEAR,
        registrationDate: dateInPastMonths(monthsBack, day),
        status,
        notes: null,
      });
    }
  }

  return { students, parents, studentSeq, parentSeq };
}
