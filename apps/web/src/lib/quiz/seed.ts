import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { getState as getStudentsState } from "@/lib/students/store";
import { getTeachersState } from "@/lib/teachers/store";
import { quizCode } from "./format";
import type { Quiz, QuizQuestion, QuizState, QuestionBankItem } from "./types";

function mcqQuestion(
  id: string,
  text: string,
  marks: number,
  correct: string,
  order: number,
): QuizQuestion {
  const opts = ["A", "B", "C", "D"].map((l, i) => ({
    id: `${id}_opt_${i}`,
    text: i === 0 ? correct : `Option ${l}`,
  }));
  return {
    id,
    type: "MCQ_SINGLE",
    text,
    marks,
    options: opts,
    correctOptionIds: [opts[0].id],
    order,
  };
}

function buildQuestions(prefix: string): QuizQuestion[] {
  return [
    mcqQuestion(`${prefix}_q1`, "What is 12 + 8?", 5, "20", 1),
    mcqQuestion(`${prefix}_q2`, "Which planet is closest to the Sun?", 5, "Mercury", 2),
    {
      id: `${prefix}_q3`,
      type: "TRUE_FALSE",
      text: "Water boils at 100°C at sea level.",
      marks: 5,
      trueFalseAnswer: true,
      order: 3,
    },
    {
      id: `${prefix}_q4`,
      type: "FILL_BLANK",
      text: "The capital of France is ____.",
      marks: 5,
      correctText: "Paris",
      order: 4,
    },
  ];
}

export function buildSeed(): QuizState {
  const tt = getTeachersState();
  const teacher = tt.teachers[0];
  const assign = tt.assignments.find((a) => a.teacherId === teacher?.id && a.status === "ACTIVE");
  const academicYear = ACTIVE_ACADEMIC_YEAR;
  const className = assign?.className ?? "Grade 8";
  const section = assign?.section ?? "A";
  const subject = assign?.subject ?? "Mathematics";
  const now = new Date();

  const bank: QuestionBankItem[] = [
    {
      id: "qb_1",
      subject: "Mathematics",
      difficulty: "EASY",
      marks: 5,
      type: "MCQ_SINGLE",
      text: "What is 5 × 6?",
      correctAnswer: "30",
      createdAt: now.toISOString(),
    },
    {
      id: "qb_2",
      subject: "Science",
      difficulty: "MEDIUM",
      marks: 5,
      type: "TRUE_FALSE",
      text: "The Earth revolves around the Sun.",
      correctAnswer: "True",
      createdAt: now.toISOString(),
    },
  ];

  const templates: Omit<Quiz, "id" | "code" | "linkPath" | "questions">[] = [
    {
      title: "Mathematics Weekly Quiz",
      academicYear,
      className,
      section,
      subject: "Mathematics",
      description: "Practice assessment for algebra fundamentals.",
      teacherId: teacher?.id ?? "t1",
      teacherName: teacher?.fullName ?? "Teacher",
      startDate: new Date(now.getTime() - 86400000 * 2).toISOString().slice(0, 10),
      endDate: new Date(now.getTime() + 86400000 * 7).toISOString().slice(0, 10),
      durationMinutes: 30,
      totalMarks: 20,
      passingMarks: 10,
      maxAttempts: 2,
      shuffleQuestions: true,
      shuffleAnswers: false,
      showResultImmediately: true,
      allowResume: true,
      status: "ACTIVE",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      publishedAt: now.toISOString(),
    },
    {
      title: "Science Chapter 3 Quiz",
      academicYear,
      className,
      section,
      subject: "Science",
      description: "Solar system and planets.",
      teacherId: teacher?.id ?? "t1",
      teacherName: teacher?.fullName ?? "Teacher",
      startDate: new Date(now.getTime() + 86400000 * 3).toISOString().slice(0, 10),
      endDate: new Date(now.getTime() + 86400000 * 10).toISOString().slice(0, 10),
      durationMinutes: 25,
      totalMarks: 20,
      passingMarks: 10,
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleAnswers: true,
      showResultImmediately: false,
      allowResume: false,
      status: "SCHEDULED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      title: "English Grammar Draft",
      academicYear,
      className,
      section,
      subject: "English",
      teacherId: teacher?.id ?? "t1",
      teacherName: teacher?.fullName ?? "Teacher",
      startDate: now.toISOString().slice(0, 10),
      endDate: new Date(now.getTime() + 86400000 * 14).toISOString().slice(0, 10),
      durationMinutes: 20,
      totalMarks: 0,
      passingMarks: 8,
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showResultImmediately: true,
      allowResume: true,
      status: "DRAFT",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
    },
    {
      title: "History Unit Test",
      academicYear,
      className,
      section,
      subject: "History",
      teacherId: teacher?.id ?? "t1",
      teacherName: teacher?.fullName ?? "Teacher",
      startDate: new Date(now.getTime() - 86400000 * 30).toISOString().slice(0, 10),
      endDate: new Date(now.getTime() - 86400000 * 5).toISOString().slice(0, 10),
      durationMinutes: 40,
      totalMarks: 20,
      passingMarks: 10,
      maxAttempts: 1,
      shuffleQuestions: false,
      shuffleAnswers: false,
      showResultImmediately: true,
      allowResume: false,
      status: "CLOSED",
      createdAt: now.toISOString(),
      updatedAt: now.toISOString(),
      publishedAt: now.toISOString(),
    },
  ];

  const quizzes: Quiz[] = templates.map((t, i) => {
    const seq = i + 1;
    const code = quizCode(seq);
    const questions = t.status === "DRAFT" ? [] : buildQuestions(`qz${seq}`);
    const totalMarks = questions.reduce((s, q) => s + q.marks, 0);
    return {
      ...t,
      id: `quiz_${seq}`,
      code,
      linkPath: `/quiz/take/${code}`,
      questions,
      totalMarks,
    };
  });

  const { students } = getStudentsState();
  const student = students.find(
    (s) => s.className === className && s.section === section && s.status === "ACTIVE",
  );

  const attempts = student
    ? [
        {
          id: "att_1",
          quizId: quizzes[0].id,
          studentId: student.id,
          studentName: student.fullName,
          studentCode: student.code,
          attemptNumber: 1,
          status: "GRADED" as const,
          answers: [],
          startedAt: new Date(now.getTime() - 86400000).toISOString(),
          submittedAt: new Date(now.getTime() - 86400000 + 1200000).toISOString(),
          timeSpentSeconds: 1200,
          totalMarks: 20,
          obtainedMarks: 16,
          percentage: 80,
          grade: "B",
          result: "PASS" as const,
        },
      ]
    : [];

  return {
    quizzes,
    questionBank: bank,
    attempts,
    audit: [
      {
        id: "qz_a1",
        action: "Quiz Created",
        user: teacher?.fullName ?? "Teacher",
        role: "TEACHER",
        quizCode: quizzes[0]?.code,
        at: now.toISOString(),
      },
    ],
    notifications: [
      {
        id: "qn1",
        audience: "STUDENT",
        message: "New quiz available: Mathematics Weekly Quiz",
        quizId: quizzes[0]?.id,
        at: now.toISOString(),
        read: false,
      },
    ],
    quizSeq: quizzes.length,
    academicYear,
  };
}
