"use client";

import { use } from "react";
import { TakeQuiz } from "@/components/quiz/take-quiz";

// The screen itself lives in a component so the teacher's practice route can
// mount the very same one: a page file may only export its page.
export default function TakeQuizPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = use(params);
  return <TakeQuiz code={code} />;
}
