"use client";

import { useT } from "@/lib/i18n/provider";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Printer } from "lucide-react";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { Badge } from "@/components/ui/badge";
import { PaymentStatusBadge, PaymentTypeBadge } from "@/components/fees/fee-status-badge";
import { money, paymentTypeLabel } from "@/lib/fees/format";
import { loadPrintHistory } from "@/lib/fees/store";
import type { ApiPrintLogRow } from "@/lib/fees/api";
import type { PaymentType } from "@/lib/fees/types";

const PAGE_SIZE = 20;

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function PrintHistoryPage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [type, setType] = useState<PaymentType | "">("");
  const [total, setTotal] = useState(0);
  const [logs, setLogs] = useState<ApiPrintLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted) return;
    setLoading(true);
    void loadPrintHistory({
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
      type: type || undefined,
    })
      .then((res) => {
        setTotal(res.total);
        setLogs(res.logs);
      })
      .finally(() => setLoading(false));
  }, [mounted, dateFrom, dateTo, type]);

  useEffect(() => setPage(1), [dateFrom, dateTo, type]);

  const pageCount = Math.max(1, Math.ceil(logs.length / PAGE_SIZE));
  const rows = useMemo(
    () => logs.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [logs, page],
  );

  return (
    <div className="space-y-6">
      <Link
        href="/finance/history"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("printHistory.backToFeeHistory")}
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{t("printHistory.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("printHistory.description")}</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-sm">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <Printer className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs text-muted-foreground">{t("printHistory.totalPrinted")}</p>
            <p className="text-3xl font-bold tabular-nums">{total}</p>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-4">
        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.dateFrom")}
          </label>
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="min-w-[130px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("financeHistory.dateTo")}
          </label>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
          />
        </div>
        <div className="min-w-[160px]">
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("printHistory.paymentStatus")}
          </label>
          <Select value={type} onChange={(e) => setType(e.target.value as PaymentType | "")}>
            <option value="">{t("financeHistory.allTypes")}</option>
            <option value="THIS_MONTH">{paymentTypeLabel("THIS_MONTH")}</option>
            <option value="PARTIAL">{paymentTypeLabel("PARTIAL")}</option>
            <option value="ADVANCE">{paymentTypeLabel("ADVANCE")}</option>
          </Select>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[800px] text-sm">
            <thead className="sticky top-0 bg-secondary text-start text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.receiptNo")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.student")}</th>
                <th className="px-4 py-2.5 font-medium">{t("financeHistory.amount")}</th>
                <th className="px-4 py-2.5 font-medium">{t("printHistory.paymentStatus")}</th>
                <th className="px-4 py-2.5 font-medium">{t("printHistory.printedAt")}</th>
                <th className="px-4 py-2.5 font-medium">{t("printHistory.printedBy")}</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {t("attendanceStudents.loading")}
                  </td>
                </tr>
              )}
              {!loading && rows.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-muted-foreground">
                    {t("printHistory.noPrintsYet")}
                  </td>
                </tr>
              )}
              {!loading &&
                rows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-2.5 font-medium text-primary">{r.receiptNumber}</td>
                    <td className="px-4 py-2.5">{r.student?.fullName ?? "—"}</td>
                    <td className="px-4 py-2.5 tabular-nums font-medium">{money(r.amount)}</td>
                    <td className="px-4 py-2.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <PaymentTypeBadge type={r.type} />
                        <PaymentStatusBadge isReversal={r.isReversal} status={r.status} />
                        {!r.isReversal && r.status === "ACTIVE" && (
                          <Badge tone={r.type === "PARTIAL" ? "warning" : "success"}>
                            {r.type === "PARTIAL"
                              ? t("printHistory.partial")
                              : t("printHistory.paid")}
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-muted-foreground">{fmtDateTime(r.printedAt)}</td>
                    <td className="px-4 py-2.5 text-muted-foreground">
                      {r.printedByUsername ?? "—"}
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        <div className="border-t px-4 py-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={logs.length}
            pageSize={PAGE_SIZE}
            onPageChange={setPage}
          />
        </div>
      </div>
    </div>
  );
}
