import { Gift } from "lucide-react";
import type { FeeChargeStatus } from "@/lib/fees/types";
import { Badge } from "@/components/ui/badge";
import { feeStatusLabel, paymentTypeLabel } from "@/lib/fees/format";
import { useT } from "@/lib/i18n/provider";

const TONE: Record<
  string,
  "success" | "warning" | "danger" | "info" | "default" | "muted"
> = {
  PAID: "success",
  PARTIAL: "warning",
  UNPAID: "danger",
  ADVANCE: "info",
  ADVANCE_MULTI: "info",
  INACTIVE: "muted",
};

export function FeeStatusBadge({
  status,
  advanceMonthsLeft,
}: {
  status: FeeChargeStatus | "ADVANCE_MULTI" | string;
  advanceMonthsLeft?: number;
}) {
  return (
    <Badge tone={TONE[status] ?? "muted"}>
      {feeStatusLabel(status, advanceMonthsLeft)}
    </Badge>
  );
}

/** A student whose fee is $0 — never actually "paid", just never charged. */
export function FreeStudentBadge() {
  const t = useT();
  return (
    <Badge tone="info">
      <Gift className="h-3 w-3" />
      {t("feesStatusBadge.free")}
    </Badge>
  );
}

export function PaymentTypeBadge({
  type,
  advanceMonths,
}: {
  type: string;
  advanceMonths?: number;
}) {
  const tone =
    type === "THIS_MONTH"
      ? "success"
      : type === "PARTIAL"
        ? "warning"
        : "info";
  return <Badge tone={tone}>{paymentTypeLabel(type, advanceMonths)}</Badge>;
}

/** Shows whether a payment row is a normal collection, a reversal entry, or a reversed original. */
export function PaymentStatusBadge({
  isReversal,
  status,
}: {
  isReversal?: boolean;
  status?: "ACTIVE" | "REVERSED";
}) {
  const t = useT();
  if (isReversal) {
    return <Badge tone="danger">{t("feesPaymentStatus.reversal")}</Badge>;
  }
  if (status === "REVERSED") {
    return <Badge tone="muted">{t("feesPaymentStatus.reversed")}</Badge>;
  }
  return null;
}
