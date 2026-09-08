"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Calendar } from "lucide-react";
import { Select } from "@/components/ui/select";
import { FeeSummaryCards } from "@/components/fees/summary-cards";
import {
  FeeMetricBreakdownDialog,
  type FeeMetric,
} from "@/components/fees/metric-breakdown-dialog";
import { RecentPaymentsPanel } from "@/components/fees/recent-payments-panel";
import { MonthSetupWidget } from "@/components/fees/month-setup-widget";
import { FeeQuickActions } from "@/components/fees/widgets";
import { CollectFeesSection } from "@/components/fees/collect-fees-section";
import { FeeCollectionCharts } from "@/components/fees/collection-charts";
import { PaymentDialog } from "@/components/fees/payment-dialog";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { PaymentPromisesBanner } from "@/components/fees/payment-promises-banner";
import { PromiseToPayDialog } from "@/components/fees/promise-to-pay-dialog";
import { monthLabel } from "@/lib/fees/format";
import {
  availableMonths,
  dashboardSummary,
  getPayment,
  outstandingStudents,
  recentPayments,
  refreshFinanceDashboard,
  refreshSchoolPosition,
  useFeesState,
} from "@/lib/fees/store";
import { classesForYear, sectionsForClass } from "@/lib/academics/store";
import type { FeePayment, StudentFeeRow } from "@/lib/fees/types";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { useStudentsState } from "@/lib/students/store";

export default function FeeManagementPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  // Every figure on this page that counts students — expected income, total
  // outstanding, the fully-paid/partial/advance/free tallies — is derived from
  // the student roster, but the page only ever subscribed to the fee store.
  // The roster arrives a moment later on a fresh load, and nothing here
  // recomputed when it did: KTS opened to Expected Monthly Income $0.00 beside
  // Outstanding This Month $6,780. Visiting Students first happened to warm
  // the cache, which is why it looked intermittent.
  const studentsState = useStudentsState();
  const [filterMonth, setFilterMonth] = useState("");
  const [filterYear, setFilterYear] = useState("");
  // Narrowing to a class is the server's job, not this page's. Filtering the
  // cards here would leave a total that the list under it cannot reproduce —
  // the disagreement this module has spent the longest fixing.
  const [filterClass, setFilterClass] = useState("");
  const [filterSection, setFilterSection] = useState("");
  const [payStudent, setPayStudent] = useState<StudentFeeRow | null>(null);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [promiseStudent, setPromiseStudent] = useState<StudentFeeRow | null>(null);
  const [bannerKey, setBannerKey] = useState(0);
  const [detailMetric, setDetailMetric] = useState<FeeMetric | null>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!mounted) return;
    setFilterMonth(fees.activeMonthKey);
    setFilterYear(fees.academicYear);
  }, [mounted, fees.activeMonthKey, fees.academicYear]);

  const month = filterMonth || fees.activeMonthKey;
  const year = filterYear || fees.academicYear;

  // The money figures are the server's — it sums every payment, while this
  // page only ever holds the newest page of them. Refetch whenever the month
  // changes so the cards never show another month's totals.
  useEffect(() => {
    if (!mounted || !month) return;
    void refreshFinanceDashboard(month);
  }, [mounted, month]);

  useEffect(() => {
    if (!mounted) return;
    void refreshSchoolPosition({
      classId: filterClass || undefined,
      sectionId: filterSection || undefined,
    });
  }, [mounted, filterClass, filterSection]);

  const classes = useMemo(
    () => (mounted ? classesForYear(year) : []),
    [mounted, year],
  );
  const sections = useMemo(
    () => (filterClass ? sectionsForClass(filterClass) : []),
    [filterClass],
  );

  const summary = useMemo(
    () => (mounted ? dashboardSummary(month, year) : null),
    [mounted, month, year, fees, studentsState],
  );
  const recent = useMemo(() => (mounted ? recentPayments(5) : []), [mounted, fees]);
  const outstanding = useMemo(
    () => (mounted ? outstandingStudents(8) : []),
    [mounted, fees, studentsState],
  );
  const months = useMemo(() => (mounted ? availableMonths() : []), [mounted, fees]);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;

  // Worded once, here, where the names behind the chosen ids are known — a
  // printed list has to say what it was filtered to or it will be read later
  // as the whole school's.
  const filterNote = useMemo(() => {
    const cls = classes.find((c) => c.id === filterClass)?.name;
    const sec = sections.find((x) => x.id === filterSection)?.name;
    if (!cls) return t("finance.allClasses");
    return sec ? `${cls} - ${sec}` : cls;
  }, [classes, sections, filterClass, filterSection, t]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("finance.feeManagement")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("finance.realTimeOverviewOfFeeCollection")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <AcademicYearSelect
              value={filterYear}
              onChange={setFilterYear}
              className="h-8 min-w-[120px] border-0 bg-transparent py-0 shadow-none"
            />
          </div>
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <span className="text-muted-foreground">{t("finance.month")}</span>
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
          <div className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Select
              value={filterClass}
              onChange={(e) => {
                setFilterClass(e.target.value);
                // A section belongs to one class, so keeping the old one
                // would ask for a section of a class no longer chosen.
                setFilterSection("");
              }}
              className="h-8 min-w-[130px] border-0 bg-transparent py-0 shadow-none"
            >
              <option value="">{t("finance.allClasses")}</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
            {sections.length > 0 && (
              <Select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="h-8 min-w-[110px] border-0 bg-transparent py-0 shadow-none"
              >
                <option value="">{t("finance.allSections")}</option>
                {sections.map((sec) => (
                  <option key={sec.id} value={sec.id}>
                    {sec.name}
                  </option>
                ))}
              </Select>
            )}
          </div>
        </div>
      </div>

      <PaymentPromisesBanner key={bannerKey} />

      {summary && (
        <FeeSummaryCards
          summary={summary}
          month={month}
          onOpenDetails={setDetailMetric}
        />
      )}

      {mounted && (
        <FeeCollectionCharts
          classId={filterClass || undefined}
          sectionId={filterSection || undefined}
        />
      )}

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
              onPromise={setPromiseStudent}
              promisesRefreshToken={bannerKey}
            />
          )}
        </div>

        {/* Right column: Month Setup, Payment Summary, Quick Actions */}
        <div className="space-y-6">
          <MonthSetupWidget activeMonthKey={month} academicYear={year} />
          {mounted && <FeeQuickActions />}
        </div>
      </div>

      <PaymentDialog
        open={!!payStudent}
        student={payStudent}
        onClose={() => setPayStudent(null)}
        onSuccess={(p: FeePayment) => setReceiptNo(p.receiptNo)}
      />

      <FeeMetricBreakdownDialog
        metric={detailMetric}
        month={month}
        academicYear={year}
        classId={filterClass || undefined}
        sectionId={filterSection || undefined}
        filterNote={filterNote}
        onClose={() => setDetailMetric(null)}
      />

      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />

      <PromiseToPayDialog
        open={!!promiseStudent}
        student={promiseStudent}
        onClose={() => setPromiseStudent(null)}
        onSuccess={() => setBannerKey((k) => k + 1)}
      />
    </div>
  );
}
