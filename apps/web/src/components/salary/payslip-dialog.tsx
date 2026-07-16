"use client";

import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import {
  money,
  monthLabel,
  paymentMethodLabel,
  shortDate,
} from "@/lib/salary/format";
import { downloadPayslipPdf, printPayslip } from "@/lib/salary/print";
import { getEmployee, paymentsForPayroll } from "@/lib/salary/store";
import type { PayrollRecord } from "@/lib/salary/types";
import { PayrollStatusBadge } from "./status-badge";

interface PayslipDialogProps {
  payroll: PayrollRecord | null;
  onClose: () => void;
}

export function PayslipDialog({ payroll, onClose }: PayslipDialogProps) {
  const branding = useSchoolBranding();
  if (!payroll) return null;
  const emp = getEmployee(payroll.employeeId);
  const payment = paymentsForPayroll(payroll.id)[0] ?? null;

  return (
    <Dialog
      open={!!payroll}
      onClose={onClose}
      title="Salary Payslip"
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
          <Button
            variant="outline"
            onClick={() => downloadPayslipPdf(payroll, payment)}
          >
            Download PDF
          </Button>
          <Button onClick={() => printPayslip(payroll, payment)}>Print Payslip</Button>
        </>
      }
    >
      <div className="space-y-4 rounded-xl border bg-secondary/20 p-5 text-sm">
        <div className="flex items-center gap-3 border-b pb-4">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="h-12 w-12 rounded-xl object-contain"
            />
          ) : (
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-lg font-bold text-white">
              {branding.name.slice(0, 2).toUpperCase()}
            </span>
          )}
          <div className="flex-1">
            <p className="font-semibold">{branding.name}</p>
            <p className="text-xs text-muted-foreground">Salary Payslip</p>
          </div>
          <PayrollStatusBadge status={payroll.status} />
        </div>
        <dl className="grid gap-2">
          <Row label="Employee" value={emp?.fullName ?? "—"} />
          <Row label="Employee ID" value={emp?.code ?? "—"} />
          <Row label="Position" value={emp?.position ?? "—"} />
          <Row label="Payroll Month" value={monthLabel(payroll.payrollMonth)} />
          <Row label="Basic Salary" value={money(payroll.basicSalary)} />
          <Row label="Allowances" value={money(payroll.allowances)} />
          <Row label="Bonus" value={money(payroll.bonus)} />
          <Row label="Deductions" value={`−${money(payroll.deductions)}`} />
          <Row label="Amount Paid" value={money(payroll.amountPaid)} />
          <Row label="Balance" value={money(payroll.remainingBalance)} />
          {payment && (
            <>
              <Row
                label="Payment Method"
                value={paymentMethodLabel(payment.paymentMethod)}
              />
              <Row label="Payment Date" value={shortDate(payment.paidAt)} />
              <Row label="Prepared By" value={payment.paidBy} />
            </>
          )}
        </dl>
        <p className="border-t pt-4 text-center text-2xl font-bold text-emerald-600">
          Net: {money(payroll.netSalary)}
        </p>
      </div>
    </Dialog>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-right font-medium">{value}</dd>
    </div>
  );
}
