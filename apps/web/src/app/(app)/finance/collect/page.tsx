"use client";

import { useEffect, useState } from "react";
import { CollectFeesSection } from "@/components/fees/collect-fees-section";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { getPayment, useFeesState } from "@/lib/fees/store";
import type { FeePayment, StudentFeeRow } from "@/lib/fees/types";

export default function CollectFeesPage() {
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const [payStudent, setPayStudent] = useState<StudentFeeRow | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Collect Fees</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Search students by class and section, then record payments.
        </p>
      </div>
      {mounted && (
        <CollectFeesSection
          academicYear={fees.academicYear}
          monthKey={fees.activeMonthKey}
          onPay={setPayStudent}
        />
      )}
      <PaymentDialog
        open={!!payStudent}
        student={payStudent}
        onClose={() => setPayStudent(null)}
        onSuccess={(p: FeePayment) => setReceiptNo(p.receiptNo)}
      />
      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
    </div>
  );
}
