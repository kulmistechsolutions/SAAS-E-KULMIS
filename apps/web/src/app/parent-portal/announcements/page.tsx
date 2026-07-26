"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo } from "react";
import { usePortalState, listAnnouncements } from "@/lib/parent-portal/store";
import {
  announcementCategoryLabel,
  relativeTime,
} from "@/lib/parent-portal/format";
import { Badge } from "@/components/ui/badge";

export default function ParentAnnouncementsPage() {
  const t = useT();
  const portal = usePortalState();
  const items = useMemo(() => listAnnouncements(), [portal.announcements]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("parentPortalAnnouncements.schoolAnnouncements")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("parentPortalAnnouncements.newestAnnouncementsAppearFirst")}</p>
      </div>

      <div className="space-y-4">
        {items.map((a) => (
          <article key={a.id} className="rounded-xl border bg-card p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-semibold">{a.title}</h2>
                  {a.pinned && <Badge tone="info">{t("parentPortalAnnouncements.pinned")}</Badge>}
                </div>
                <Badge tone="muted" className="mt-2">
                  {announcementCategoryLabel(a.category)}
                </Badge>
              </div>
              <time className="text-xs text-muted-foreground">{relativeTime(a.publishedAt)}</time>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{a.body}</p>
          </article>
        ))}
      </div>
    </div>
  );
}
