"use client";

import { useEffect, useState } from "react";
import { apiTeacherPortalNotifications } from "@/lib/teacher-portal/api";
import type { TeacherPortalNotification } from "@/lib/teacher-portal/types";

export default function TeacherPortalNotificationsPage() {
  const [items, setItems] = useState<TeacherPortalNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void apiTeacherPortalNotifications()
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Notifications</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          School notices and updates for your account.
        </p>
      </div>
      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted-foreground">No notifications.</p>
      ) : (
        <ul className="divide-y rounded-xl border bg-card">
          {items.map((n) => (
            <li key={n.id} className="px-4 py-3">
              <p className="font-medium">{n.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
              <p className="mt-1 text-xs text-muted-foreground">
                {new Date(n.createdAt).toLocaleString()}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
