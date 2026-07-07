import { Badge } from "@/components/ui/badge";
import { promotionTypeLabel } from "@/lib/promotions/format";
import type { PromotionCandidate, PromotionType } from "@/lib/promotions/types";

export function EligibilityBadge({ candidate }: { candidate: PromotionCandidate }) {
  if (candidate.graduating) {
    return <Badge tone="info">Graduating</Badge>;
  }
  return candidate.eligible ? (
    <Badge tone="success" dot>
      Eligible
    </Badge>
  ) : (
    <Badge tone="danger" dot>
      Ineligible
    </Badge>
  );
}

export function PromotionTypeBadge({ type }: { type: PromotionType }) {
  const tone = type === "SCHOOL_WIDE" ? "info" : type === "CLASS" ? "warning" : "default";
  return <Badge tone={tone}>{promotionTypeLabel(type)}</Badge>;
}
