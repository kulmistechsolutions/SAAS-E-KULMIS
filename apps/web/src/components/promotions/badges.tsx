
import { useT } from "@/lib/i18n/provider";
import { Badge } from "@/components/ui/badge";
import { promotionTypeLabel } from "@/lib/promotions/format";
import type { PromotionCandidate, PromotionType } from "@/lib/promotions/types";

export function EligibilityBadge({ candidate }: { candidate: PromotionCandidate }) {
  const t = useT();
  if (candidate.graduating) {
    return <Badge tone="info">{t("promotionsBadges.graduating")}</Badge>;
  }
  return candidate.eligible ? (
    <Badge tone="success" dot>
      {t("promotionsBadges.eligible")}
    </Badge>
  ) : (
    <Badge tone="danger" dot>
      {t("promotionsBadges.ineligible")}
    </Badge>
  );
}

export function PromotionTypeBadge({ type }: { type: PromotionType }) {
  const tone = type === "SCHOOL_WIDE" ? "info" : type === "CLASS" ? "warning" : "default";
  return <Badge tone={tone}>{promotionTypeLabel(type)}</Badge>;
}
