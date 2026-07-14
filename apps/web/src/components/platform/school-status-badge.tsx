import type { SchoolStatus } from "@/lib/platform/types";
import { cn } from "@/lib/utils";

const TONES: Record<SchoolStatus, string> = {
  ACTIVE: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  SUSPENDED: "bg-rose-500/12 text-rose-600 dark:text-rose-400",
};

export function SchoolStatusBadge({
  status,
  className,
}: {
  status: SchoolStatus;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium",
        TONES[status],
        className,
      )}
    >
      {status === "ACTIVE" ? "Active" : "Suspended"}
    </span>
  );
}
