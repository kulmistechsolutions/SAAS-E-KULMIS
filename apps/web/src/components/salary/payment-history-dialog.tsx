"use client";

import { useEffect, useState } from "react";
import { RotateCcw } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { PaymentStatusBadge } from "@/components/fees/fee-status-badge";
import { formatMoney } from "@/lib/settings/currency";
import { loadPayrollPayments } from "@/lib/salary/store";
import type { PayrollRecord, SalaryPayment } from "@/lib/salary/types";
import { ReverseSalaryPaymentDialog } from "./reverse-payment-dialog";

function money(n: number) {
  return formatMoney(n, { decimals: 0 });
}

interface PaymentHistoryDialogProps {
  payroll: PayrollRecord | null;
  employeeName?: string;
  onClose: () => void;
}

export function SalaryPaymentHistoryDialog({
  payroll,
  employeeName,
  onClose,
}: PaymentHistoryDialogProps) {
  const t = useT();
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(false);
  const [reversing, setReversing] = useState<SalaryPayment | null>(null);

  useEffect(() => {
    if (!payroll) return;
    setLoading(true);
    void loadPayrollPayments(payroll.id)
      .then(setPayments)
      .finally(() => setLoading(false));
  }, [payroll]);

  if (!payroll) return null;

  async function refresh() {
    setLoading(true);
    const rows = await loadPayrollPayments(payroll!.id);
    setPayments(rows);
    setLoading(false);
  }

  return (
    <>
      <Dialog
        open={!!payroll}
        onClose={onClose}
        title={t("salaryPaymentHistory.title")}
        description={employeeName}
        className="max-w-lg"
        footer={
          <Button variant="outline" onClick={onClose}>
            {t("salaryPaymentHistory.close")}
          </Button>
        }
      >
        {loading ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("salaryPaymentHistory.loading")}
          </p>
        ) : payments.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("salaryPaymentHistory.noPayments")}
          </p>
        ) : (
          <div className="divide-y rounded-xl border">
            {payments.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                <div className="min-w-0">
                  <p className={`font-medium tabular-nums ${p.amount < 0 ? "text-rose-600" : ""}`}>
                    {money(p.amount)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(p.paidAt).toLocaleString()}
                  </p>
                  {p.notes && <p className="mt-0.5 text-xs text-muted-foreground">{p.notes}</p>}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <PaymentStatusBadge isReversal={p.isReversal} status={p.status} />
                  {!p.isReversal && p.status === "ACTIVE" && (
                    <Button
                      variant="ghost"
                      className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700"
                      onClick={() => setReversing(p)}
                    >
                      <RotateCcw className="me-1 h-3.5 w-3.5" />
                      {t("salaryPaymentHistory.reverse")}
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Dialog>

      <ReverseSalaryPaymentDialog
        payment={reversing}
        employeeName={employeeName}
        onClose={() => {
          setReversing(null);
          void refresh();
        }}
      />
    </>
  );
}
