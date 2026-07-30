"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { usePortal, usePortalAudit } from "@/components/parent-portal/portal-context";
import { loadChildFeeSummary } from "@/lib/parent-portal/store";
import { money } from "@/lib/students/format";

export default function ParentFeesPage() {
  const t = useT();
  const { selectedChild } = usePortal();
  usePortalAudit("FEE_VIEWED", selectedChild?.id);

  const [fees, setFees] = useState<Awaited<ReturnType<typeof loadChildFeeSummary>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedChild) {
      setLoading(false);
      return;
    }
    setLoading(true);
    void loadChildFeeSummary(selectedChild).then((data) => {
      setFees(data);
      setLoading(false);
    });
  }, [selectedChild]);

  if (!selectedChild) {
    return <p className="text-muted-foreground">{t("parentPortalFees.selectAChildToViewFee")}</p>;
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("parentPortalFees.loadingFeeInformation")}</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("parentPortalFees.feeInformation")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{selectedChild.fullName}</p>
      </div>

      {fees && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[
              { label: "Monthly Fee", value: money(fees.monthlyFee) },
              { label: "Outstanding", value: money(fees.outstanding) },
              { label: "Paid Months", value: String(fees.paidMonths) },
              { label: "Partial Payments", value: String(fees.partialMonths) },
              { label: "Advance Months", value: String(fees.advanceMonths) },
              { label: "Carry Forward", value: money(fees.carryForward) },
            ].map((c) => (
              <div key={c.label} className="rounded-xl border bg-card p-4">
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="mt-1 text-xl font-bold">{c.value}</p>
              </div>
            ))}
          </div>

          <div className="overflow-x-auto rounded-xl border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-secondary/50 text-start">
                  <th className="px-4 py-3">{t("parentPortalFees.month")}</th>
                  <th className="px-4 py-3">{t("parentPortalFees.charge")}</th>
                  <th className="px-4 py-3">{t("parentPortalFees.paid")}</th>
                  <th className="px-4 py-3">{t("parentPortalFees.balance")}</th>
                  <th className="px-4 py-3">{t("parentPortalFees.status")}</th>
                </tr>
              </thead>
              <tbody>
                {fees.ledger.map((r) => (
                  <tr key={r.monthKey} className="border-b">
                    <td className="px-4 py-3">{r.monthLabel}</td>
                    <td className="px-4 py-3">{money(r.monthlyCharge)}</td>
                    <td className="px-4 py-3">{money(r.amountPaid)}</td>
                    <td className="px-4 py-3">{money(r.remainingBalance)}</td>
                    <td className="px-4 py-3">{r.status}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
