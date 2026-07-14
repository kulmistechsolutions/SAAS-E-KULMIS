"use client";

import { api } from "@/lib/api";

export interface AdminDashboardResponse {
  students: {
    total: number;
    active: number;
    inactive: number;
    graduated: number;
    newThisMonth: number;
  };
  teachers: { total: number; morning: number; afternoon: number };
  parents: { total: number };
  academics: { classes: number; sections: number; subjects: number };
  attendanceToday: {
    present: number;
    absent: number;
    late: number;
    total: number;
    percentage: number;
  };
  teacherAttendanceToday: { present: number; absent: number };
  fees: {
    totalOutstanding: number;
    outstandingThisMonth: number;
    collectedToday: number;
    collectedThisMonth: number;
    partialPayments: number;
    advancePayments: number;
  };
  finance: {
    totalIncome: number;
    totalExpenses: number;
    totalSalaries: number;
    netIncome: number;
  };
  activeAcademicYear: string | null;
  charts: {
    studentGrowth: { label: string; value: number }[];
    feeCollection: { label: string; value: number }[];
    incomeVsExpense: { label: string; income: number; expense: number }[];
  };
  recentPayments: {
    id: string;
    receiptNumber: string;
    student: string;
    studentCode: string;
    className: string | null;
    amount: number;
    type: string;
    paidAt: string;
  }[];
  recentActivities: {
    id: string;
    module: string;
    action: string;
    username: string;
    createdAt: string;
  }[];
}

export async function apiAdminDashboard(): Promise<AdminDashboardResponse> {
  return api<AdminDashboardResponse>("/dashboard/admin");
}

export interface TeacherDashboardResponse {
  today: string;
  school: {
    name: string;
    logoKey: string | null;
  };
  teacher: {
    id: string;
    code: string;
    fullName: string;
    shift: string;
    phone: string | null;
    email: string | null;
    gender: string;
    status: string;
  };
  stats: {
    students: number;
    classes: number;
    sections: number;
    subjects: number;
    assignments: number;
    activeExams: number;
    pendingSubmissions: number;
    activeQuizzes: number;
    completedQuizzes: number;
    quizzes: number;
  };
  attendanceToday: {
    present: number;
    absent: number;
    late: number;
    excused: number;
    total: number;
    percentage: number;
  };
  upcomingExams: {
    id: string;
    name: string;
    className: string;
    section: string | null;
    startDate: string;
    endDate: string;
    status: string;
    subjects: string[];
  }[];
  activeQuizzes: {
    id: string;
    title: string;
    code: string;
    status: string;
    className: string;
    section: string | null;
  }[];
  schedule: {
    id: string;
    academicYear: string;
    className: string;
    classId: string;
    section: string | null;
    sectionId: string | null;
    subject: string;
    subjectId: string;
  }[];
  announcements: {
    id: string;
    title: string;
    body: string;
    audience: string;
    publishedAt: string;
  }[];
  notifications: {
    id: string;
    title: string;
    body: string;
    type: string;
    readAt: string | null;
    createdAt: string;
  }[];
}

export async function apiTeacherDashboard(): Promise<TeacherDashboardResponse> {
  return api<TeacherDashboardResponse>("/dashboard/teacher");
}

export const money = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
