"use client";


import { useT } from "@/lib/i18n/provider";
import { useEffect, useState } from "react";
import { Download, X } from "lucide-react";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { useInstallState, promptInstall } from "@/lib/pwa/install";

const DISMISS_KEY = "ekulmis_pwa_install_dismissed_v1";

/**
 * Registers the service worker and shows a friendly, dismissible "Install app"
 * banner when the browser says the app is installable. The banner carries the
 * school's own name and logo, so a parent installs *their* school's app.
 *
 * iOS never fires `beforeinstallprompt`, so on an iPhone/iPad (not already in
 * standalone) we show a short "Add to Home Screen" hint instead.
 */
export function PwaInstaller() {
  const t = useT();
  const branding = useSchoolBranding();
  const support = useInstallState();
  const [dismissed, setDismissed] = useState(true);

  // Register the service worker once.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* SW is an enhancement — ignore failures */
      });
    };
    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  // Read the dismissal after mount so the server and first client render agree.
  useEffect(() => {
    try {
      setDismissed(!!localStorage.getItem(DISMISS_KEY));
    } catch {
      setDismissed(false);
    }
  }, []);

  const iosHint = support === "ios-manual";
  // Closing this hides the banner only. The offer itself is held by the shared
  // store, so Settings and Profile can still install afterwards.
  const visible =
    !dismissed && (support === "ready" || support === "ios-manual");

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* private mode — fine */
    }
  }

  async function install() {
    await promptInstall();
    dismiss();
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[70] flex justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div className="animate-fade-up flex w-full max-w-md items-center gap-3 rounded-2xl border bg-card p-3 shadow-xl">
        {branding.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={branding.logoUrl}
            alt=""
            className="h-11 w-11 shrink-0 rounded-xl bg-secondary object-contain p-1"
          />
        ) : (
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">
            {t("pwaPwaInstaller.install")} {branding.name}
          </p>
          <p className="text-xs text-muted-foreground">
            {iosHint
              ? "Tap Share, then “Add to Home Screen”."
              : "Add it to your home screen for quick, app-like access."}
          </p>
        </div>
        {!iosHint && (
          <button
            type="button"
            onClick={() => void install()}
            className="shrink-0 rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            {t("pwaPwaInstaller.install")}
          </button>
        )}
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("pwaPwaInstaller.dismiss")}
          className="shrink-0 rounded-lg p-1.5 text-muted-foreground hover:bg-secondary"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
