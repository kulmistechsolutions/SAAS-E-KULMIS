import { Badge } from "@/components/ui/badge";
import { statusLabel } from "@/lib/academics/format";

export function StatusBadge({ status }: { status: string }) {
  const tone =
    status === "ACTIVE"
      ? "success"
      : status === "CLOSED"
        ? "muted"
        : status === "INACTIVE"
          ? "danger"
          : "default";
  return <Badge tone={tone as never}>{statusLabel(status)}</Badge>;
}
