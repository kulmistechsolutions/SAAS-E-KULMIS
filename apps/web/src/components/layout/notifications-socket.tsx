"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuth } from "@/lib/auth";
import { API_URL } from "@/lib/api";
import { toast } from "@/lib/toast";
import { refreshMyNotifications } from "@/lib/notifications/store";
import { refreshPortalData } from "@/lib/parent-portal/store";

interface NotificationPayload {
  title?: string;
  body?: string;
}

/**
 * A tab left open on any page — dashboard, a report, whatever — used to
 * have no way of knowing a new announcement existed until someone happened
 * to click into Notifications and pull the REST list themselves. The
 * backend already emitted a socket event on every create (`emitToSchool`
 * in NotificationsController), nothing on the client was ever listening for
 * it — `socket.io-client` sat in package.json unused. This is that listener,
 * mounted once at the root so it covers the admin app and both portals.
 */
export function NotificationsSocket() {
  const { user } = useAuth();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;

    const socket = io(`${API_URL}/notifications`, {
      query: { schoolId: user.schoolId },
      transports: ["websocket", "polling"],
    });
    socketRef.current = socket;

    if (
      typeof window !== "undefined" &&
      "Notification" in window &&
      Notification.permission === "default"
    ) {
      void Notification.requestPermission();
    }

    function onNotification(payload: NotificationPayload) {
      const title = payload?.title ?? "New notification";
      const body = payload?.body ?? "";
      toast(body ? `${title}: ${body}` : title, "info");

      if (
        typeof window !== "undefined" &&
        "Notification" in window &&
        Notification.permission === "granted" &&
        document.visibilityState === "hidden"
      ) {
        try {
          new Notification(title, { body });
        } catch {
          // Some browsers restrict Notification() outside a service worker
          // context — the in-app toast above already covers the user.
        }
      }

      if (user?.role === "PARENT") {
        void refreshPortalData();
      } else {
        void refreshMyNotifications();
      }
    }

    socket.on("notification", onNotification);

    return () => {
      socket.off("notification", onNotification);
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user?.schoolId, user?.role]);

  return null;
}
