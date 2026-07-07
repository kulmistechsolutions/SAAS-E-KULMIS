"use client";

import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { usePortal } from "@/components/parent-portal/portal-context";
import {
  markAllNotificationsRead,
  markNotificationRead,
  parentNotifications,
  usePortalState,
} from "@/lib/parent-portal/store";
import { relativeTime } from "@/lib/parent-portal/format";
import { cn } from "@/lib/utils";

export default function ParentNotificationsPage() {
  const { parent } = usePortal();
  const portal = usePortalState();

  const items = useMemo(
    () => parentNotifications(parent.id),
    [parent.id, portal.notifications],
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Attendance, exams, fees, quizzes, and school updates
          </p>
        </div>
        {items.some((n) => !n.read) && (
          <Button onClick={() => markAllNotificationsRead(parent.id)}>
            Mark all read
          </Button>
        )}
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {items.map((n) => (
          <li
            key={n.id}
            className={cn(
              "flex cursor-pointer items-start justify-between gap-4 px-5 py-4 transition-colors hover:bg-secondary/50",
              !n.read && "bg-primary/5",
            )}
            onClick={() => markNotificationRead(n.id)}
          >
            <div>
              <p className={cn("font-medium", !n.read && "text-primary")}>{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.message}</p>
            </div>
            <span className="shrink-0 text-xs text-muted-foreground">
              {relativeTime(n.createdAt)}
            </span>
          </li>
        ))}
        {items.length === 0 && (
          <li className="px-5 py-12 text-center text-muted-foreground">No notifications yet.</li>
        )}
      </ul>
    </div>
  );
}
