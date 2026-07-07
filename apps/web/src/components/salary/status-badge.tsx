import type { PayrollStatus } from "@/lib/salary/types";
import { Badge } from "@/components/ui/badge";
import { payrollStatusLabel } from "@/lib/salary/format";

const TONE: Record<PayrollStatus, "success" | "warning" | "danger"> = {
  PAID: "success",
  PARTIAL: "warning",
  PENDING: "danger",
};

export function PayrollStatusBadge({ status }: { status: PayrollStatus }) {
  return <Badge tone={TONE[status]}>{payrollStatusLabel(status)}</Badge>;
}
