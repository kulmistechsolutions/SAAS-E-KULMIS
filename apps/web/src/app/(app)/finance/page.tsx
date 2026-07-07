"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Select } from "@/components/ui/select";
import { FeeSummaryCards } from "@/components/fees/summary-cards";
import { RecentPaymentsPanel } from "@/components/fees/recent-payments-panel";
import { MonthSetupWidget } from "@/components/fees/month-setup-widget";
import { PaymentSummaryWidget, FeeQuickActions } from "@/components/fees/widgets";
import { CollectFeesSection } from "@/components/fees/collect-fees-section";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { monthLabel } from "@/lib/fees/format";
import {
  availableMonths,
  dashboardSummary,
  getPayment,
  outstandingStudents,
  paymentSummary,
  recentPayments,
  useFeesState,
} from "@/lib/fees/store";
import type { FeePayment, StudentFeeRow } from "@/lib/fees/types";
import { ACADEMIC_YEARS } from "@/lib/students/constants";

export default function FeeManagementPage() {
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  const [payStudent, setPayStudent] = useState<StudentFeeRow | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    setFilterMonth(fees.activeMonthKey);
    setFilterYear(fees.academicYear);
  }, [mounted, fees.activeMonthKey, fees.academicYear]);

  const month = filterMonth || fees.activeMonthKey;
  const year = filterYear || fees.academicYear;

  const summary = useMemo(
    () => (mounted ? dashboardSummary(month, year) : null),
    [mounted, month, year, fees],
  );
  const slices = useMemo(
    () => (mounted ? paymentSummary(month) : []),
    [mounted, month, fees],
  );
  const recent = useMemo(() => (mounted ? recentPayments(5) : []), [mounted, fees]);
  const outstanding = useMemo(
    () => (mounted ? outstandingStudents(8) : []),
    [mounted, fees],
  );
  const months = useMemo(() => (mounted ? availableMonths() : []), [mounted, fees]);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Fee Management</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Real-time overview of fee collection, outstanding balances, and payments.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={filterYear}
              onChange={(e) => setFilterYear(e.target.value)}
              className="h-8 min-w-[120px] border-0 bg-transparent py-0 shadow-none"
            >
              {ACADEMIC_YEARS.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">Month:</span>
            <Select
              value={month}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="h-8 min-w-[140px] border-0 bg-transparent py-0 shadow-none"
            >
              {months.map((m) => (
                <option key={m} value={m}>
                  {monthLabel(m)}
                </option>
              ))}
            </Select>
          </div>
        </div>
      </div>

      {summary && <FeeSummaryCards summary={summary} />}

      <div className="grid items-start gap-6 xl:grid-cols-3">
        {/* Left column: Recent Payments, then Collect Fees */}
        <div className="space-y-6 xl:col-span-2">
          {mounted && (
            <RecentPaymentsPanel
              recent={recent}
              outstanding={outstanding}
              onViewReceipt={setReceiptNo}
            />
          )}
          {mounted && (
            <CollectFeesSection
              academicYear={year}
              monthKey={month}
              onPay={setPayStudent}
            />
          )}
        </div>

        {/* Right column: Month Setup, Payment Summary, Quick Actions */}
        <div className="space-y-6">
          <MonthSetupWidget activeMonthKey={month} academicYear={year} />
          {mounted && (
            <>
              <PaymentSummaryWidget
                slices={slices}
                totalStudents={summary?.totalActiveStudents ?? 0}
              />
              <FeeQuickActions />
            </>
          )}
        </div>
      </div>

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
