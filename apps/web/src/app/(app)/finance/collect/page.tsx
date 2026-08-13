"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Users, UserSquare2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { ClassFeeGrid } from "@/components/fees/class-fee-grid";
import { CollectFeesSection } from "@/components/fees/collect-fees-section";
import { FamilyCollectSection } from "@/components/fees/family-collect-section";
import { FamilyPaymentDialog } from "@/components/fees/family-payment-dialog";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { getPayment, useFeesState } from "@/lib/fees/store";
import type { FamilyFeeRow, FeePayment, StudentFeeRow } from "@/lib/fees/types";
import { toast } from "@/lib/toast";

type Tab = "class" | "family";

export default function CollectFeesPage() {
  const t = useT();
  const [tab, setTab] = useState<Tab>("class");
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const [payStudent, setPayStudent] = useState<StudentFeeRow | null>(null);
  const [payFamily, setPayFamily] = useState<FamilyFeeRow | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("financeCollect.collectFees")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {tab === "class"
            ? t("financeCollect.searchStudentsByClassAndSection")
            : t("feesFamilyCollectSection.searchByParentNamePhoneOrAny")}
        </p>
      </div>

      {!(tab === "class" && selectedClass === null) && (
        <div className="inline-flex rounded-xl border bg-card p-1">
          <button
            type="button"
            onClick={() => setTab("class")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "class" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <UserSquare2 className="h-4 w-4" />
            {t("financeCollect.byClass")}
          </button>
          <button
            type="button"
            onClick={() => setTab("family")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "family" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary",
            )}
          >
            <Users className="h-4 w-4" />
            {t("financeCollect.byFamily")}
          </button>
        </div>
      )}

      {mounted && tab === "class" && selectedClass === null && (
        <ClassFeeGrid
          academicYear={fees.academicYear}
          monthKey={fees.activeMonthKey}
          onSelectClass={setSelectedClass}
        />
      )}
      {mounted && tab === "class" && selectedClass !== null && (
        <CollectFeesSection
          key={selectedClass}
          academicYear={fees.academicYear}
          monthKey={fees.activeMonthKey}
          onPay={setPayStudent}
          initialClass={selectedClass}
          onBack={() => setSelectedClass(null)}
        />
      )}
      {mounted && tab === "family" && (
        <FamilyCollectSection
          academicYear={fees.academicYear}
          monthKey={fees.activeMonthKey}
          onPayFamily={setPayFamily}
        />
      )}

      <PaymentDialog
        open={!!payStudent}
        student={payStudent}
        onClose={() => setPayStudent(null)}
        onSuccess={(p: FeePayment) => setReceiptNo(p.receiptNo)}
      />
      <FamilyPaymentDialog
        open={!!payFamily}
        family={payFamily}
        onClose={() => setPayFamily(null)}
        onSuccess={(result) => {
          const names = result.receipts.map((r) => `${r.studentName} (${r.receiptNumber})`).join(", ");
          toast(`Receipts issued: ${names}`, "success");
        }}
      />
      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
    </div>
  );
}
