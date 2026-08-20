"use client";

import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { useT } from "@/lib/i18n/provider";
import {
  announcementCategoryLabel,
  relativeTime,
} from "@/lib/parent-portal/format";
import type { PortalAnnouncement } from "@/lib/parent-portal/types";
import {
  apiStudentPortalAnnouncements,
  type StudentPortalAnnouncement,
} from "@/lib/student-portal/api";

export default function StudentPortalAnnouncementsPage() {
  const t = useT();
  const [items, setItems] = useState<StudentPortalAnnouncement[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiStudentPortalAnnouncements()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  // Pinned first, then newest — the same order the parent portal uses, so a
  // notice a school pinned for everyone reads the same way in both places.
  const sorted = [...items].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1;
    return b.publishedAt.localeCompare(a.publishedAt);
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("studentPortalAnnouncements.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("studentPortalAnnouncements.subtitle")}
        </p>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">
          {t("studentPortalAnnouncements.loading")}
        </p>
      ) : sorted.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center text-muted-foreground">
          {t("studentPortalAnnouncements.empty")}
        </div>
      ) : (
        <div className="space-y-4">
          {sorted.map((a) => (
            <article key={a.id} className="rounded-xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="font-semibold">{a.title}</h2>
                    {a.pinned && (
                      <Badge tone="info">
                        {t("studentPortalAnnouncements.pinned")}
                      </Badge>
                    )}
                  </div>
                  <Badge tone="muted" className="mt-2">
                    {announcementCategoryLabel(
                      a.audience as PortalAnnouncement["category"],
                    )}
                  </Badge>
                </div>
                <time className="text-xs text-muted-foreground">
                  {relativeTime(a.publishedAt)}
                </time>
              </div>
              <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                {a.body}
              </p>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
