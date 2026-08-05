"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import { Download, Eye, Printer, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { PaymentStatusBadge, PaymentTypeBadge } from "@/components/fees/fee-status-badge";
import { ReceiptDialog } from "@/components/fees/receipt-dialog";
import { ReversePaymentDialog } from "@/components/fees/reverse-payment-dialog";
import { money, paymentTypeLabel, shortDate } from "@/lib/fees/format";
import { exportPaymentsCsv, printReceipt } from "@/lib/fees/print";
import { getPayment, useFeesState } from "@/lib/fees/store";
import { getState as getStudentsState } from "@/lib/students/store";
import type { PaymentType } from "@/lib/fees/types";
import { classNamesForYear, groupClassNames, useAcademicsState } from "@/lib/academics/store";

const PAGE_SIZE = 15;

export default function FeeHistoryPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const fees = useFeesState();
  const academics = useAcademicsState();
  const [search, setSearch] = useState("");
  const [klass, setKlass] = useState("");
  const [paymentType, setPaymentType] = useState<PaymentType | "">("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);
  const [receiptNo, setReceiptNo] = useState<string | null>(null);
  const [reversingId, setReversingId] = useState<string | null>(null);
  useEffect(() => setMounted(true), []);

  const students = getStudentsState().students;
  const classOptions = useMemo(
    () => classNamesForYear(fees.academicYear),
    [fees.academicYear, academics.classes],
  );
  const classGroups = useMemo(
    () => groupClassNames(classOptions, fees.academicYear, t("common.defaultGrades")),
    [classOptions, fees.academicYear, academics.structureTrees, t],
  );

  const filtered = useMemo(() => {
    if (!mounted) return [];
    const q = search.trim().toLowerCase();
    const from = dateFrom ? new Date(dateFrom) : null;
    // End-of-day so a payment recorded any time on the "to" date is included.
    const to = dateTo ? new Date(`${dateTo}T23:59:59.999`) : null;
    return fees.payments.filter((p) => {
      const st = students.find((s) => s.id === p.studentId);
      if (q) {
        const matches =
          p.receiptNo.toLowerCase().includes(q) ||
          st?.fullName.toLowerCase().includes(q) ||
          st?.code.toLowerCase().includes(q);
        if (!matches) return false;
      }
      if (klass && st?.className !== klass) return false;
      if (paymentType && p.paymentType !== paymentType) return false;
      const at = new Date(p.collectedAt);
      if (from && at < from) return false;
      if (to && at > to) return false;
      return true;
    });
  }, [mounted, fees.payments, search, klass, paymentType, dateFrom, dateTo, students]);
  // Any filter change can shrink the result set below the current page.
  useEffect(() => setPage(1), [search, klass, paymentType, dateFrom, dateTo]);

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const rows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const receipt = receiptNo ? getPayment(receiptNo) ?? null : null;
  const reversingPayment = reversingId
    ? fees.payments.find((p) => p.id === reversingId) ?? null
    : null;
  const reversingStudent = reversingPayment
    ? students.find((s) => s.id === reversingPayment.studentId)
    : undefined;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("financeHistory.feeHistory")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("financeHistory.allRecordedPaymentsWithReceipts")}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="h-9"
            onClick={() => exportPaymentsCsv(fees.payments)}
          >
            <Download className="me-2 h-4 w-4" />
            {t("financeHistory.exportCsv")}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-[200px] flex-[2]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.search")}
          </label>
          <Input
            placeholder={t("financeHistory.searchReceiptStudentNameOrId")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("feesCollectFeesSection.class")}
          </label>
          <Select value={klass} onChange={(e) => setKlass(e.target.value)}>
            <option value="">{t("feesCollectFeesSection.allClasses")}</option>
            {classGroups.map((g) =>
              g.label === null ? (
                g.names.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))
              ) : (
                <optgroup key={g.label} label={g.label}>
                  {g.names.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </optgroup>
              ),
            )}
          </Select>
        </div>
        <div className="min-w-[140px] flex-1">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.type")}
          </label>
          <Select
            value={paymentType}
            onChange={(e) => setPaymentType(e.target.value as PaymentType | "")}
          >
            <option value="">{t("financeHistory.allTypes")}</option>
            <option value="THIS_MONTH">{paymentTypeLabel("THIS_MONTH")}</option>
            <option value="PARTIAL">{paymentTypeLabel("PARTIAL")}</option>
            <option value="ADVANCE">{paymentTypeLabel("ADVANCE")}</option>
          </Select>
        </div>
        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.dateFrom")}
          </label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </div>
        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.dateTo")}
          </label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </div>
        <Button
          variant="outline"
          onClick={() => {
            setSearch("");
            setKlass("");
            setPaymentType("");
            setDateFrom("");
            setDateTo("");
          }}
        >
          {t("feesCollectFeesSection.reset")}
        </Button>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.receiptNo")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.student")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.classSection")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.amount")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.type")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.collectedBy")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.date")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => {
                const st = students.find((s) => s.id === p.studentId);
                return (
                  <tr key={p.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium text-primary">{p.receiptNo}</td>
                    <td className="px-4 py-2.5">{st?.fullName ?? "—"}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {st?.className} - {st?.section}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums font-medium">{money(p.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PaymentTypeBadge type={p.paymentType} advanceMonths={p.advanceMonths} />
                        <PaymentStatusBadge isReversal={p.isReversal} status={p.status} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{p.collectedBy}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">{shortDate(p.collectedAt)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => setReceiptNo(p.receiptNo)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => printReceipt(p)}
                          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-secondary"
                        >
                          <Printer className="h-4 w-4" />
                        </button>
                        {!p.isReversal && p.status !== "REVERSED" && (
                          <button
                            type="button"
                            onClick={() => setReversingId(p.id)}
                            title={t("financeHistory.reversePayment")}
                            className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                          >
                            <Undo2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={filtered.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>

      <ReceiptDialog payment={receipt} onClose={() => setReceiptNo(null)} />
      <ReversePaymentDialog
        payment={reversingPayment}
        studentName={reversingStudent?.fullName}
        onClose={() => setReversingId(null)}
      />
    </div>
  );
}
