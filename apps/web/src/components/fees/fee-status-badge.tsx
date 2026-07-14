import type { FeeChargeStatus } from "@/lib/fees/types";
import { Badge } from "@/components/ui/badge";
import { feeStatusLabel } from "@/lib/fees/format";

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
  const label =
    type === "THIS_MONTH"
      ? "This Month"
      : type === "PARTIAL"
        ? "Partial Payment"
        : `Advance (${advanceMonths ?? 1} Month${(advanceMonths ?? 1) > 1 ? "s" : ""})`;
  return <Badge tone={tone}>{label}</Badge>;
}
