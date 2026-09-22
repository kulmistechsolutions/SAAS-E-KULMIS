"use client";

import { use } from "react";
import { PracticeQuiz } from "@/components/quiz/take-quiz";
import { useAuth } from "@/lib/auth";

/**
 * A teacher taking their own quiz as a student would — no Student ID.
 *
 * The same screen a student sits, so what is tested is what is sat. The score
 * is kept apart from every student's result.
 */
export default function QuizPracticePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { user } = useAuth();
  const base = user?.role === "TEACHER" ? "/teacher-portal/quizzes" : "/quiz";
  return <PracticeQuiz quizId={id} backHref={`${base}/${id}`} />;
}
