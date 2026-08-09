"use client";

import { useEffect } from "react";

const RELOADED_KEY = "ekulmis_chunk_reload_at";
// Once per minute is enough to recover from a stale tab after a deploy
// without looping forever if a chunk is genuinely missing.
const COOLDOWN_MS = 60_000;

function looksLikeChunkLoadFailure(message: unknown): boolean {
  if (typeof message !== "string") return false;
  return (
    message.includes("ChunkLoadError") ||
    message.includes("Loading chunk") ||
    message.includes("Failed to fetch dynamically imported module")
  );
}

function reloadOnce() {
  const last = Number(sessionStorage.getItem(RELOADED_KEY) ?? 0);
  if (Date.now() - last < COOLDOWN_MS) return;
  sessionStorage.setItem(RELOADED_KEY, String(Date.now()));
  window.location.reload();
}

/**
 * A tab left open across a deploy still holds references to the *previous*
 * build's JS chunk filenames (they're content-hashed). The instant that tab
 * navigates or lazy-loads a route, the browser requests a chunk the server
 * no longer serves and webpack throws ChunkLoadError — the user sees a dead
 * page with no indication anything is wrong. A single automatic reload picks
 * up the current build and the navigation just works.
 */
export function ChunkErrorReloader() {
  useEffect(() => {
    function onError(e: ErrorEvent) {
      if (looksLikeChunkLoadFailure(e.message)) reloadOnce();
    }
    function onRejection(e: PromiseRejectionEvent) {
      const reason = e.reason;
      const message =
        reason instanceof Error ? reason.message : String(reason ?? "");
      if (looksLikeChunkLoadFailure(message)) reloadOnce();
    }
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
