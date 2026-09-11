"use client";

import type { StudentPosition } from "@/lib/fees/api";
import type { FeePayment } from "@/lib/fees/types";
import type { ExamResultCardData } from "@/components/examinations/exam-result-card";
import type { StudentWithParent } from "@/lib/students/types";

/**
 * Stand-in data for the template previews.
 *
 * Deliberately obvious as a sample — "Sample Student", "SAMPLE-0001" — so a
 * preview can never be mistaken for a real document if it is printed by
 * accident. Real records would be worse in two ways: a school comparing
 * designs would be printing a family's balance to do it, and whichever student
 * happened to be first would be the one whose money ended up on the settings
 * screen.
 *
 * The shapes are the real ones, so the preview runs the same code path a
 * printed document does. A preview built from its own simplified shape is how
 * a mock-up drifts from what actually prints.
 */

export function samplePayment(): FeePayment {
  const now = new Date().toISOString();
  return {
    id: "sample",
    receiptNo: "RCP-SAMPLE",
    studentId: "sample-student",
    academicYear: "2026/2027",
    amount: 50,
    paymentType: "THIS_MONTH",
    monthKeys: ["2026-09"],
    lines: [{ label: "Monthly School Fee (September 2026)", amount: 50 }],
    collectedBy: "Finance Officer",
    collectedAt: now,
    outstandingAfter: 0,
    status: "ACTIVE",
  };
}

export function sampleInvoicePosition(): StudentPosition {
  return {
    studentId: "sample-student",
    code: "SAMPLE-0001",
    fullName: "Sample Student",
    className: "Grade 4",
    section: "A",
    monthlyFee: 50,
    free: false,
    expected: 110,
    paid: 80,
    outstanding: 30,
    advance: 0,
    credit: 0,
    state: "PARTIAL",
    lines: [
      {
        id: "s1",
        kind: "MONTHLY",
        label: "Monthly School Fee (August 2026)",
        year: 2026,
        month: 8,
        monthKey: "2026-08",
        expected: 50,
        paid: 50,
        outstanding: 0,
        credit: 0,
        due: true,
        status: "PAID",
      },
      {
        id: "s2",
        kind: "MONTHLY",
        label: "Monthly School Fee (September 2026)",
        year: 2026,
        month: 9,
        monthKey: "2026-09",
        expected: 50,
        paid: 30,
        outstanding: 20,
        credit: 0,
        due: true,
        status: "PARTIAL",
      },
      {
        id: "s3",
        kind: "EXTRA",
        label: "Examination Fee",
        year: 2026,
        month: 9,
        monthKey: "2026-09",
        expected: 10,
        paid: 0,
        outstanding: 10,
        credit: 0,
        due: true,
        status: "UNPAID",
      },
    ],
  };
}

export function sampleResultCard(): ExamResultCardData {
  const subjects = [
    { subject: "Mathematics", maxMarks: 100, marksObtained: 85, grade: "A" },
    { subject: "English", maxMarks: 100, marksObtained: 78, grade: "B" },
    { subject: "Science", maxMarks: 100, marksObtained: 82, grade: "A" },
    { subject: "Social Studies", maxMarks: 100, marksObtained: 75, grade: "B" },
    { subject: "Somali", maxMarks: 100, marksObtained: 88, grade: "A" },
  ];
  const totalObtained = subjects.reduce((n, s) => n + (s.marksObtained ?? 0), 0);
  const totalMax = subjects.reduce((n, s) => n + s.maxMarks, 0);
  return {
    studentName: "Sample Student",
    studentCode: "SAMPLE-0001",
    className: "Grade 4",
    section: "A",
    academicYear: "2026/2027",
    examName: "Sample Exam",
    term: "First Term",
    subjects,
    totalObtained,
    totalMax,
    average: (totalObtained / totalMax) * 100,
    grade: "A",
    passed: true,
  };
}

/** A stand-in student for the letter and information-sheet previews. */
export function sampleStudent(): StudentWithParent {
  const now = new Date().toISOString();
  return {
    id: "sample-student",
    code: "SAMPLE-0001",
    fullName: "Sample Student",
    gender: "MALE",
    dob: "2014-03-12T00:00:00.000Z",
    phone: null,
    parentId: "sample-parent",
    className: "Grade 5",
    section: "A",
    village: null,
    monthlyFee: 10,
    academicYear: "2026-2027",
    registrationDate: now,
    status: "ACTIVE",
    placeOfBirth: "Sample City",
    district: "Sample District",
    motherName: "Sample Mother",
    // No photo: a stand-in face would be somebody's, and the layout has to
    // read correctly without one anyway.
    hasPhoto: false,
    photoUrl: null,
    parent: {
      id: "sample-parent",
      code: "SAMPLE-P001",
      name: "Sample Guardian",
      phone: "+252 61 000 0000",
      altPhone: null,
      email: "guardian@example.com",
      address: "Sample Address",
      occupation: "Sample Occupation",
      registrationDate: now,
      status: "ACTIVE",
      username: "sample",
      password: "",
    },
  };
}
