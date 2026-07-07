import type { Student } from "@/lib/students/types";
import { studentQuizHistory } from "@/lib/quiz/store";
import {
  attendanceHistory,
  examHistory,
  feeHistory,
  promotionHistory,
} from "@/lib/students/history";

export { attendanceHistory, examHistory, feeHistory, promotionHistory };

export function quizHistory(student: Student) {
  return studentQuizHistory(student.id);
}

export interface PaymentRow {
  receiptNumber: string;
  studentName: string;
  amount: number;
  type: string;
  paidAt: string;
}

export function parentPaymentHistory(children: Student[]): PaymentRow[] {
  const rows: PaymentRow[] = [];
  children.forEach((child, ci) => {
    const fees = feeHistory(child, 4).filter((f) => f.paid > 0);
    fees.forEach((f, fi) => {
      rows.push({
        receiptNumber: `RCP-${child.code.slice(-4)}-${ci}${fi}`,
        studentName: child.fullName,
        amount: f.paid,
        type: f.status === "PAID" ? "This Month" : "Partial",
        paidAt: f.date ?? new Date().toISOString(),
      });
    });
  });
  return rows.sort(
    (a, b) => new Date(b.paidAt).getTime() - new Date(a.paidAt).getTime(),
  );
}
