"use client";

import { useEffect, useRef } from "react";

/**
 * Shared across tabs so activity in one tab keeps every other tab (and the
 * PWA instance) from timing out independently, and so a background tab
 * whose setTimeout was throttled by the browser still catches up the moment
 * it's checked again.
 */
const ACTIVITY_KEY = "ekulmis_last_activity";
const ACTIVITY_EVENTS = [
  "mousedown",
  "keydown",
  "touchstart",
  "wheel",
  "scroll",
] as const;
/** Don't hammer localStorage on every mousemove/scroll tick. */
const WRITE_THROTTLE_MS = 5_000;

/**
 * Logs the user out the moment they've been inactive for `timeoutMinutes` —
 * exactly the value the school configured (Settings → Security), not just
 * whenever the next API call happens to 401. Switching to another tab or
 * leaving the app open and untouched counts as inactivity: only real
 * mousedown/keydown/touch/scroll activity resets the clock.
 */
export function useIdleLogout(
  timeoutMinutes: number | undefined,
  onTimeout: () => void,
): void {
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!timeoutMinutes || timeoutMinutes <= 0) return;
    const timeoutMs = timeoutMinutes * 60_000;

    let timer: ReturnType<typeof setTimeout> | null = null;
    let lastWrite = 0;

    function scheduleFrom(lastActivity: number) {
      if (timer) clearTimeout(timer);
      const remaining = timeoutMs - (Date.now() - lastActivity);
      if (remaining <= 0) {
        onTimeoutRef.current();
        return;
      }
      timer = setTimeout(() => {
        // Re-check against wall-clock time (not just "did the timer fire") —
        // another tab may have bumped activity, or this tab's timer may have
        // been throttled while backgrounded and is firing late.
        const stored = Number(window.localStorage.getItem(ACTIVITY_KEY) ?? 0);
        const latest = Math.max(stored, lastActivity);
        if (Date.now() - latest >= timeoutMs) {
          onTimeoutRef.current();
        } else {
          scheduleFrom(latest);
        }
      }, remaining);
    }

    function markActivity() {
      const now = Date.now();
      if (now - lastWrite > WRITE_THROTTLE_MS) {
        lastWrite = now;
        window.localStorage.setItem(ACTIVITY_KEY, String(now));
      }
      scheduleFrom(now);
    }

    function onStorage(e: StorageEvent) {
      if (e.key !== ACTIVITY_KEY || !e.newValue) return;
      scheduleFrom(Number(e.newValue));
    }

    // Returning to a hidden tab doesn't reset the clock — it just forces an
    // immediate check, so a tab left open in the background can't quietly
    // outlive the configured timeout.
    function onVisibility() {
      if (document.visibilityState !== "visible") return;
      const stored = Number(window.localStorage.getItem(ACTIVITY_KEY) ?? Date.now());
      scheduleFrom(stored);
    }

    const initial = Date.now();
    window.localStorage.setItem(ACTIVITY_KEY, String(initial));
    scheduleFrom(initial);

    for (const ev of ACTIVITY_EVENTS) {
      window.addEventListener(ev, markActivity, { passive: true });
    }
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      if (timer) clearTimeout(timer);
      for (const ev of ACTIVITY_EVENTS) {
        window.removeEventListener(ev, markActivity);
      }
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [timeoutMinutes]);
}
