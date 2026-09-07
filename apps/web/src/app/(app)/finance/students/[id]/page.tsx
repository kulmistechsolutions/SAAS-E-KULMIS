"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { FailureScreen } from "@/components/system/failure-screen";
import { money, monthLabel } from "@/lib/fees/format";
import {
  apiListPayments,
  apiStudentPosition,
  type ApiPayment,
  type StudentPosition,
} from "@/lib/fees/api";

/**
 * One student's fee account — everything they have been charged and everything
 * they have paid, on one page.
 *
 * The system could already answer "what does this school expect this month",
 * but not "why does this child owe $100", and that second question is the one
 * a parent standing at the desk actually asks. The answer had to be assembled
 * from the collection screen, the payment history and the receipt printer, and
 * a school with a disputed balance had no page to point at.
 *
 * Every row here is a charge the engine holds, so this page and the dashboard
 * are the same arithmetic seen at two distances: add up the Balance column of
 * every student and you have the dashboard's outstanding figure.
 */

const STATUS_TONE: Record<string, string> = {
  PAID: "text-emerald-600 dark:text-emerald-400",
  PARTIAL: "text-amber-600 dark:text-amber-400",
  UNPAID: "text-rose-600 dark:text-rose-400",
  ADVANCE: "text-purple-600 dark:text-purple-400",
  FREE: "text-teal-600 dark:text-teal-400",
  INACTIVE: "text-muted-foreground",
};

export default function StudentFeeAccountPage() {
  const t = useT();
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const studentId = params?.id;

  const [position, setPosition] = useState<StudentPosition | null>(null);
  const [payments, setPayments] = useState<ApiPayment[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing" | "failed">(
    "loading",
  );

  const load = useCallback(() => {
    if (!studentId) return;
    setState("loading");
    Promise.all([
      apiStudentPosition(studentId),
      apiListPayments(200, studentId).catch(() => [] as ApiPayment[]),
    ])
      .then(([pos, pays]) => {
        if (!pos) {
          setState("missing");
          return;
        }
        setPosition(pos);
        setPayments(pays);
        setState("ready");
      })
      .catch(() => setState("failed"));
  }, [studentId]);

  useEffect(load, [load]);

  if (state === "loading") {
    return (
      <div className="space-y-4">
        <div className="h-8 w-64 animate-pulse rounded bg-secondary/60" />
        <div className="h-28 animate-pulse rounded-2xl bg-secondary/60" />
        <div className="h-64 animate-pulse rounded-2xl bg-secondary/60" />
      </div>
    );
  }

  if (state !== "ready" || !position) {
    return (
      <FailureScreen
        kind={state === "missing" ? "NOT_FOUND" : "GENERIC"}
        onRetry={state === "missing" ? undefined : load}
      />
    );
  }

  const p = position;
  // Only months that were actually billed. An inactive line is a month the
  // school never set up, and showing it as a $0 row invites the reading that
  // the child was charged nothing when in truth they were charged nothing
  // *yet* — the distinction this whole module exists to keep.
  const lines = p.lines.filter((l) => l.status !== "INACTIVE");

  const totals = [
    { label: t("studentFeeAccount.expected"), value: money(p.expected), tone: "" },
    {
      label: t("studentFeeAccount.paid"),
      value: money(p.paid),
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      label: t("studentFeeAccount.outstanding"),
      value: money(p.outstanding),
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      label: t("studentFeeAccount.advance"),
      value: money(p.advance),
      tone: "text-purple-600 dark:text-purple-400",
    },
    {
      label: t("studentFeeAccount.credit"),
      value: money(p.credit),
      tone: "text-sky-600 dark:text-sky-400",
    },
  ];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            className="h-9 print:hidden"
            onClick={() => router.back()}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold">{p.fullName}</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              {p.code}
              {p.className ? ` · ${p.className}` : ""}
              {p.section ? ` - ${p.section}` : ""}
              {p.free ? ` · ${t("studentFeeAccount.freeStudent")}` : ""}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          className="h-9 print:hidden"
          onClick={() => window.print()}
        >
          <Printer className="h-4 w-4" />
          {t("studentFeeAccount.print")}
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {totals.map((c) => (
          <div key={c.label} className="rounded-xl border bg-card p-4 shadow-sm">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {c.label}
            </p>
            <p className={`mt-2 text-xl font-bold tabular-nums ${c.tone}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">{t("studentFeeAccount.ledger")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("studentFeeAccount.ledgerIntro")}
          </p>
        </div>
        {lines.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("studentFeeAccount.nothingBilled")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("studentFeeAccount.period")}</th>
                  <th className="p-3 text-end">{t("studentFeeAccount.expected")}</th>
                  <th className="p-3 text-end">{t("studentFeeAccount.paid")}</th>
                  <th className="p-3 text-end">{t("studentFeeAccount.balance")}</th>
                  <th className="p-3 text-start">{t("studentFeeAccount.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {lines.map((l) => (
                  <tr key={l.id}>
                    <td className="p-3 font-medium">
                      {l.label}
                      {!l.due && (
                        <span className="ms-2 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-medium text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                          {t("studentFeeAccount.notYetDue")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-end tabular-nums">{money(l.expected)}</td>
                    <td className="p-3 text-end tabular-nums">{money(l.paid)}</td>
                    <td className="p-3 text-end font-medium tabular-nums">
                      {money(l.outstanding)}
                    </td>
                    <td className={`p-3 font-medium ${STATUS_TONE[l.status] ?? ""}`}>
                      {l.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b p-4">
          <h2 className="font-semibold">{t("studentFeeAccount.payments")}</h2>
        </div>
        {payments.length === 0 ? (
          <p className="p-6 text-center text-sm text-muted-foreground">
            {t("studentFeeAccount.noPayments")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("studentFeeAccount.receipt")}</th>
                  <th className="p-3 text-end">{t("studentFeeAccount.amount")}</th>
                  <th className="p-3 text-start">{t("studentFeeAccount.method")}</th>
                  <th className="p-3 text-start">{t("studentFeeAccount.covered")}</th>
                  <th className="p-3 text-start">{t("studentFeeAccount.date")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {payments.map((pay) => (
                  <tr
                    key={pay.id}
                    className={pay.status === "REVERSED" ? "opacity-60" : ""}
                  >
                    <td className="p-3 font-medium">
                      {pay.receiptNumber}
                      {pay.status === "REVERSED" && (
                        <span className="ms-2 rounded bg-rose-100 px-1.5 py-0.5 text-[10px] font-medium text-rose-700 dark:bg-rose-500/15 dark:text-rose-300">
                          {t("studentFeeAccount.reversed")}
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-end tabular-nums">{money(pay.amount)}</td>
                    <td className="p-3 text-muted-foreground">{pay.method ?? "—"}</td>
                    <td className="p-3 text-muted-foreground">
                      {(pay.allocations ?? [])
                        .map((a) =>
                          a.feeCharge.label ??
                          monthLabel(
                            `${a.feeCharge.year}-${String(a.feeCharge.month).padStart(2, "0")}`,
                          ),
                        )
                        .join(", ") || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {pay.paidAt.slice(0, 10)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
