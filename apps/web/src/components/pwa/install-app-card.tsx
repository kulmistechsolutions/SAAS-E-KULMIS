"use client";

import { useState } from "react";
import { Check, Download, Share, Smartphone } from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useInstallState, promptInstall } from "@/lib/pwa/install";
import { Button } from "@/components/ui/button";

/**
 * A permanent home for "install the app".
 *
 * The install banner appears once and can be closed for good, which left
 * anyone who closed it — or who changed phone — with no way back. This sits in
 * Settings and on every user's own profile, so it can always be found.
 */
export function InstallAppCard() {
  const branding = useSchoolBranding();
  const support = useInstallState();
  const [busy, setBusy] = useState(false);
  const [dismissedNow, setDismissedNow] = useState(false);

  async function onInstall() {
    setBusy(true);
    const outcome = await promptInstall();
    setBusy(false);
    if (outcome === "dismissed") setDismissedNow(true);
  }

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-start gap-4">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="h-12 w-12 shrink-0 rounded-xl bg-secondary object-contain p-1"
          />
        ) : (
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Smartphone className="h-6 w-6" />
          </span>
        )}

        <div className="min-w-0 flex-1">
          <h3 className="font-semibold">Install {branding.name}</h3>

          {support === "installed" ? (
            <p className="mt-1 flex items-center gap-1.5 text-sm text-emerald-600 dark:text-emerald-400">
              <Check className="h-4 w-4" />
              Installed on this device.
            </p>
          ) : support === "ios-manual" ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                On iPhone and iPad the app is added by hand:
              </p>
              <ol className="mt-2 space-y-1 text-sm text-muted-foreground">
                <li className="flex items-center gap-1.5">
                  <span className="font-semibold text-foreground">1.</span>
                  Tap <Share className="h-3.5 w-3.5" /> Share at the bottom of Safari
                </li>
                <li>
                  <span className="font-semibold text-foreground">2.</span> Choose
                  “Add to Home Screen”
                </li>
                <li>
                  <span className="font-semibold text-foreground">3.</span> Tap “Add”
                </li>
              </ol>
            </>
          ) : support === "ready" ? (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                Add it to your home screen to open it like any other app — full
                screen, and it starts faster.
              </p>
              <Button
                className="mt-3"
                onClick={() => void onInstall()}
                disabled={busy}
              >
                <Download className="me-2 h-4 w-4" />
                {busy ? "Installing…" : "Install app"}
              </Button>
              {dismissedNow && (
                <p className="mt-2 text-xs text-muted-foreground">
                  Not installed — you can come back here any time.
                </p>
              )}
            </>
          ) : (
            <>
              <p className="mt-1 text-sm text-muted-foreground">
                This browser cannot install the app. Open{" "}
                <span className="font-medium text-foreground">
                  {branding.name}
                </span>{" "}
                in Chrome on Android, or Safari on iPhone, and this option will
                appear here.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                Already installed? Then there is nothing to do — open it from
                your home screen.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
