"use client";

import { useEffect } from "react";
import {
  FailureScreen,
  classifyFailure,
} from "@/components/system/failure-screen";
import {
  looksLikeChunkLoadFailure,
  reloadOnce,
} from "@/components/layout/chunk-error-reloader";

/**
 * Any crash inside a page, caught before Next.js shows its own message.
 *
 * `reset()` re-renders the segment, which is the right first move for the
 * transient causes — a dropped connection mid-fetch, a slow API — and costs
 * nothing when it isn't.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // A tab left open across a deploy asks for chunk files the server no
    // longer has. The window-level listener catches most of those, but one
    // thrown while React is rendering arrives here instead — and showing a
    // school an error screen for "we shipped a new version a minute ago" is
    // the wrong answer when a reload fixes it outright.
    if (looksLikeChunkLoadFailure(error.message)) {
      reloadOnce();
      return;
    }
    // Kept for whoever is looking at the console; the school sees the screen.
    console.error("[ekulmis] page error", error);
  }, [error]);

  return <FailureScreen kind={classifyFailure(error)} onRetry={reset} />;
}
