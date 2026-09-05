import type { Student } from "@/lib/students/types";
import { studentQuizHistory } from "@/lib/quiz/store";
import { attendanceHistory } from "@/lib/students/history";

/**
 * A parent's profile reads the school's own records and nothing else.
 *
 * `feeHistory`, `examHistory`, `promotionHistory` and `parentPaymentHistory`
 * used to live here. All four were generated — fee months the school never
 * set up, receipt numbers built from the student's code, exam averages from a
 * random number generator — and they were rendered on a real parent's page as
 * if the school had recorded them. They are gone; the page now calls
 * /fees/ledger, the published exam results, and the recorded promotions.
 */
export { attendanceHistory };

export function quizHistory(student: Student) {
  return studentQuizHistory(student.id);
}
