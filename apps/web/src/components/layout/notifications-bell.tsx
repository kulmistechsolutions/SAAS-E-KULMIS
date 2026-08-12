"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Megaphone } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { relativeTime } from "@/lib/parent-portal/format";
import {
  markMyNotificationRead,
  myUnreadCount,
  refreshMyNotifications,
  useMyNotifications,
} from "@/lib/notifications/store";
import { cn } from "@/lib/utils";

/** The topbar bell: real unread count, real list, marks read on click. */
export function NotificationsBell() {
  const t = useT();
  const router = useRouter();
  const { items, loaded } = useMyNotifications();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = myUnreadCount();

  useEffect(() => {
    void refreshMyNotifications();
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const recent = items.slice(0, 8);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("topbar.notifications")}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg border border-input text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute -end-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border bg-card shadow-lg">
          <div className="border-b px-3 py-2 text-sm font-semibold text-foreground">
            {t("topbar.notifications")}
          </div>
          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">…</p>
            ) : recent.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-muted-foreground">
                {t("topbarNotificationsBell.noNotificationsYet")}
              </p>
            ) : (
              recent.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => {
                    if (!n.readAt) void markMyNotificationRead(n.id);
                    setOpen(false);
                    router.push("/announcements");
                  }}
                  className={cn(
                    "flex w-full items-start gap-2.5 border-b px-3 py-2.5 text-start last:border-0 hover:bg-secondary",
                    !n.readAt && "bg-primary/5",
                  )}
                >
                  <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-1.5">
                      <span className="truncate text-sm font-medium text-foreground">
                        {n.title}
                      </span>
                      {!n.readAt && (
                        <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {n.body}
                    </span>
                    <span className="mt-0.5 block text-[10px] text-muted-foreground">
                      {relativeTime(n.createdAt)}
                    </span>
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
