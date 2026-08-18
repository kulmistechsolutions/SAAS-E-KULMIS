"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import Link from "next/link";
import { AlertTriangle, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import { shortDate } from "@/lib/students/format";
import {
  apiListDuePaymentPromises,
  type ApiDuePaymentPromise,
} from "@/lib/fees/api";

/**
 * Amber/red strip listing parents who promised to pay by a date that's
 * overdue or within the next 3 days — a reminder for reception, not a
 * blocker. Silent when there's nothing pending. Loaded from
 * GET /fees/payment-promises/due.
 */
export function PaymentPromisesBanner() {
  const t = useT();
  const [rows, setRows] = useState<ApiDuePaymentPromise[]>([]);

  useEffect(() => {
    let cancelled = false;
    void apiListDuePaymentPromises()
      .then((res) => {
        if (!cancelled) setRows(res);
      })
      .catch(() => {
        /* roles without access simply hide the banner */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (rows.length === 0) return null;

  const missedCount = rows.filter((r) => r.status === "MISSED").length;
  const tone = missedCount > 0 ? "red" : "orange";
  const styles = {
    orange:
      "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100",
    red: "border-rose-500/40 bg-rose-500/10 text-rose-900 dark:text-rose-100",
  } as const;
  const Icon = tone === "red" ? AlertTriangle : Clock;

  return (
    <div
      role="status"
      className={cn(
        "mb-4 space-y-1.5 rounded-lg border px-3 py-2 text-xs",
        styles[tone],
      )}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <p className="font-medium">
          {t("feesPaymentPromisesBanner.nParentsPromisedToPay", {
            count: rows.length,
          })}
        </p>
      </div>
      <ul className="ms-5 list-disc space-y-0.5">
        {rows.slice(0, 5).map((r) => (
          <li key={r.id}>
            <Link
              href={`/students/${r.studentId}`}
              className="font-medium underline-offset-2 hover:underline"
            >
              {r.studentName}
            </Link>
            {" — "}
            {shortDate(r.promisedDate)}
            {r.status === "MISSED" ? ` (${t("feesPaymentPromisesBanner.overdue")})` : ""}
            {r.note ? ` · ${r.note}` : ""}
          </li>
        ))}
      </ul>
      {rows.length > 5 && (
        <p className="opacity-80">
          {t("feesPaymentPromisesBanner.andNMore", { count: rows.length - 5 })}
        </p>
      )}
    </div>
  );
}
