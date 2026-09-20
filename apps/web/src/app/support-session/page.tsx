"use client";

import { useEffect, useState } from "react";
import { Loader2, ShieldAlert } from "lucide-react";
import { setAccessToken, setRefreshToken } from "@/lib/api";

/**
 * Where a support session lands.
 *
 * The platform console opens this on the school's own subdomain with the token
 * in the URL fragment — after the `#`, which browsers never send to a server,
 * so the session does not end up in an access log or a referrer header on its
 * way in. It is read once, put where the app keeps its token, and the address
 * bar is rewritten before anything else loads.
 */
export default function SupportSessionPage() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const token = new URLSearchParams(hash).get("token");
    if (!token) {
      setError("This link has no session in it. Open it from the platform console.");
      return;
    }
    setAccessToken(token);
    // A support session is deliberately not refreshable: it ends when it ends.
    setRefreshToken(null);
    // Take it out of the address bar before the dashboard loads, so it is not
    // left in history for the next person at this machine.
    window.history.replaceState(null, "", "/support-session");
    window.location.replace("/dashboard");
  }, []);

  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-sm rounded-2xl border bg-card p-8 text-center shadow-sm">
        {error ? (
          <>
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
              <ShieldAlert className="h-6 w-6" />
            </span>
            <p className="mt-4 text-sm text-muted-foreground">{error}</p>
          </>
        ) : (
          <>
            <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
            <p className="mt-4 text-sm text-muted-foreground">
              Opening support session…
            </p>
          </>
        )}
      </div>
    </main>
  );
}
