"use client";

import { FailureScreen } from "@/components/system/failure-screen";

/**
 * A URL that matches no page. Reached most often by a mistyped address or a
 * stale link, so it is worded as an address problem rather than a fault.
 */
export default function NotFound() {
  return (
    <FailureScreen
      kind="UNKNOWN_TENANT"
      onRetry={() => {
        window.location.href = "/login";
      }}
    />
  );
}
