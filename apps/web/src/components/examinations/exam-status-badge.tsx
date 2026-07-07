import type { ExamStatus, SubmissionStatus } from "@/lib/examinations/types";
import { Badge } from "@/components/ui/badge";
import { examStatusLabel, submissionStatusLabel } from "@/lib/examinations/format";

const EXAM_TONE: Record<string, "default" | "success" | "warning" | "danger" | "info" | "muted"> = {
  DRAFT: "muted",
  OPEN: "info",
  IN_PROGRESS: "warning",
  COMPLETED: "default",
  LOCKED: "warning",
  PUBLISHED: "success",
  ARCHIVED: "muted",
};

const SUB_TONE: Record<string, "success" | "warning" | "danger" | "muted"> = {
  PENDING: "warning",
  SUBMITTED: "success",
  LOCKED: "muted",
};

export function ExamStatusBadge({ status }: { status: ExamStatus | string }) {
  return (
    <Badge tone={EXAM_TONE[status] ?? "muted"}>
      {examStatusLabel(status)}
    </Badge>
  );
}

export function SubmissionStatusBadge({ status }: { status: SubmissionStatus | string }) {
  return (
    <Badge tone={SUB_TONE[status] ?? "muted"}>
      {submissionStatusLabel(status)}
    </Badge>
  );
}
