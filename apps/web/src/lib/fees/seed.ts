import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { getState as getStudentsState } from "@/lib/students/store";
import { monthLabel, nextMonthKey } from "./format";
import type {
  FeeCharge,
  FeeChargeStatus,
  FeePayment,
  FeesState,
  PaymentType,
} from "./types";

/** Stable demo date so dashboard numbers match the design mockup. */
export const DEMO_TODAY = "2024-05-28T10:30:00.000Z";
export const DEMO_MONTH_KEY = "2024-05";
export const DEMO_ACADEMIC_YEAR = ACTIVE_ACADEMIC_YEAR;

function rng(seed: number) {
  let s = seed;
  return () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };
}

function chargeStatus(
  monthlyFee: number,
  amountPaid: number,
  advanceCovered?: boolean,
): FeeChargeStatus {
  if (advanceCovered) return "ADVANCE";
  if (amountPaid >= monthlyFee) return "PAID";
  if (amountPaid > 0) return "PARTIAL";
  return "UNPAID";
}

function upsertCharge(
  charges: FeeCharge[],
  partial: Omit<FeeCharge, "balance" | "status">,
): FeeCharge {
  const balance = Math.max(0, partial.monthlyFee - partial.amountPaid);
  const c: FeeCharge = {
    ...partial,
    balance,
    status: chargeStatus(
      partial.monthlyFee,
      partial.amountPaid,
      partial.advanceCovered,
    ),
  };
  charges.push(c);
  return c;
}

export function buildSeed(): FeesState {
  const st = getStudentsState();
  const activeStudents = st.students.filter((s) => s.status === "ACTIVE");
  const charges: FeeCharge[] = [];
  const payments: FeePayment[] = [];
  let chargeSeq = 0;
  let paySeq = 0;
  let receiptSeq = 1000;

  const startMonth = "2024-01";
  const activeMonth = DEMO_MONTH_KEY;
  const months = [startMonth];
  let m = startMonth;
  while (m !== activeMonth) {
    m = nextMonthKey(m);
    months.push(m);
  }

  const billingPeriods = months.map((monthKey, i) => ({
    id: `bp_${i + 1}`,
    academicYear: DEMO_ACADEMIC_YEAR,
    monthKey,
    activatedAt: `${monthKey}-01T08:00:00.000Z`,
    status: (monthKey === activeMonth ? "ACTIVE" : "CLOSED") as
      | "ACTIVE"
      | "CLOSED",
  }));

  const collectors = ["Admin User", "Finance Officer", "Sarah Ahmed"];

  activeStudents.forEach((student, idx) => {
    const rand = rng(idx * 31 + 7);
    const roll = rand();
    let advanceLeft = 0;
    if (roll > 0.88) advanceLeft = 2 + Math.floor(rand() * 3);
    else if (roll > 0.82) advanceLeft = 1;

    const studentCharges: FeeCharge[] = [];

    months.forEach((mk, mi) => {
      chargeSeq += 1;
      const fee = student.monthlyFee;
      let amountPaid = 0;
      let advanceCovered = false;

      if (advanceLeft > 0) {
        advanceCovered = true;
        amountPaid = fee;
        advanceLeft -= 1;
      } else if (mi < months.length - 1) {
        const r = rand();
        if (r > 0.72) amountPaid = fee;
        else if (r > 0.55) amountPaid = Math.round(fee * (0.3 + rand() * 0.5));
      } else {
        const r = rand();
        if (r > 0.58) amountPaid = fee;
        else if (r > 0.42) amountPaid = Math.round(fee * (0.25 + rand() * 0.55));
      }

      const paidAt =
        amountPaid > 0
          ? `${mk}-${String(8 + (idx % 18)).padStart(2, "0")}T${String(9 + (idx % 8)).padStart(2, "0")}:00:00.000Z`
          : null;

      upsertCharge(studentCharges, {
        id: `fc_${chargeSeq}`,
        studentId: student.id,
        academicYear: DEMO_ACADEMIC_YEAR,
        monthKey: mk,
        monthlyFee: fee,
        amountPaid,
        paymentDate: paidAt,
        advanceCovered,
      });
    });

    charges.push(...studentCharges);

    studentCharges
      .filter((c) => c.amountPaid > 0 && !c.advanceCovered)
      .forEach((c) => {
        paySeq += 1;
        receiptSeq += 1;
        const type: PaymentType =
          c.amountPaid >= c.monthlyFee ? "THIS_MONTH" : "PARTIAL";
        payments.push({
          id: `fp_${paySeq}`,
          receiptNo: `RCP-${receiptSeq}`,
          studentId: student.id,
          academicYear: DEMO_ACADEMIC_YEAR,
          amount: c.amountPaid,
          paymentType: type,
          monthKeys: [c.monthKey],
          collectedBy: collectors[idx % collectors.length],
          collectedAt: c.paymentDate ?? `${c.monthKey}-15T10:00:00.000Z`,
          outstandingAfter: c.balance,
        });
      });
  });

  // Demo recent payments matching mockup feel
  const demoPayments: Partial<FeePayment>[] = [
    {
      receiptNo: "RCP-2847",
      amount: 150,
      paymentType: "THIS_MONTH",
      collectedAt: "2024-05-28T09:15:00.000Z",
    },
    {
      receiptNo: "RCP-2846",
      amount: 450,
      paymentType: "ADVANCE",
      advanceMonths: 3,
      collectedAt: "2024-05-28T08:42:00.000Z",
    },
    {
      receiptNo: "RCP-2845",
      amount: 75,
      paymentType: "PARTIAL",
      collectedAt: "2024-05-27T14:20:00.000Z",
    },
    {
      receiptNo: "RCP-2844",
      amount: 150,
      paymentType: "THIS_MONTH",
      collectedAt: "2024-05-27T11:05:00.000Z",
    },
    {
      receiptNo: "RCP-2843",
      amount: 300,
      paymentType: "ADVANCE",
      advanceMonths: 2,
      collectedAt: "2024-05-26T16:30:00.000Z",
    },
  ];

  const pickStudents = activeStudents.slice(0, demoPayments.length);
  demoPayments.forEach((dp, i) => {
    const s = pickStudents[i];
    if (!s) return;
    payments.unshift({
      id: `fp_demo_${i}`,
      receiptNo: dp.receiptNo!,
      studentId: s.id,
      academicYear: DEMO_ACADEMIC_YEAR,
      amount: dp.amount!,
      paymentType: dp.paymentType!,
      advanceMonths: dp.advanceMonths,
      monthKeys: [activeMonth],
      collectedBy: "Admin User",
      collectedAt: dp.collectedAt!,
      outstandingAfter: 0,
    });
  });

  return {
    academicYear: DEMO_ACADEMIC_YEAR,
    activeMonthKey: activeMonth,
    billingPeriods,
    charges,
    payments,
    receiptSeq: receiptSeq + 50,
    audit: [
      {
        id: "fa_1",
        action: "Month Setup",
        user: "Admin User",
        at: "2024-05-01T08:00:00.000Z",
        detail: `Activated ${monthLabel(activeMonth)}`,
      },
    ],
  };
}
