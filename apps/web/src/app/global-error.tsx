"use client";

import {
  FailureScreen,
  classifyFailure,
} from "@/components/system/failure-screen";

/**
 * The last resort: a crash in the root layout itself, where even the app's
 * stylesheet may not have loaded. Next.js replaces the whole document here,
 * so this must supply its own <html> and <body> — and the screen it renders
 * carries its own styling for the same reason.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body style={{ margin: 0 }}>
        <FailureScreen kind={classifyFailure(error)} onRetry={reset} />
      </body>
    </html>
  );
}
