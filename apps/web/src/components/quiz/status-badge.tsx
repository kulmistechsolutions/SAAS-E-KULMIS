import type { QuizStatus } from "@/lib/quiz/types";
import { Badge } from "@/components/ui/badge";
import { quizStatusLabel } from "@/lib/quiz/format";

const TONE: Record<QuizStatus, "success" | "warning" | "danger" | "info" | "muted" | "default"> = {
  DRAFT: "muted",
  SCHEDULED: "info",
  ACTIVE: "success",
  CLOSED: "warning",
  PUBLISHED: "success",
  ARCHIVED: "default",
};

export function QuizStatusBadge({ status }: { status: QuizStatus }) {
  return <Badge tone={TONE[status]}>{quizStatusLabel(status)}</Badge>;
}
