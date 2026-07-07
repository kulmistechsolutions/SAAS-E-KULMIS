import type { AccountStatus } from "@/lib/users/types";
import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/users/format";

const TONE: Record<AccountStatus, "success" | "warning" | "danger" | "muted"> = {
  ACTIVE: "success",
  INACTIVE: "muted",
  LOCKED: "danger",
};

export function AccountStatusBadge({ status }: { status: AccountStatus }) {
  return <Badge tone={TONE[status]}>{statusLabel(status)}</Badge>;
}
