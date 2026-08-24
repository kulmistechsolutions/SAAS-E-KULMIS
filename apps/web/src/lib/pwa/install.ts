"use client";

import { useSyncExternalStore } from "react";

/** The `beforeinstallprompt` event isn't in the DOM lib types yet. */
export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

export type InstallSupport =
  /** The browser offered a prompt — one tap installs. */
  | "ready"
  /** iOS Safari never offers one; the user adds it by hand. */
  | "ios-manual"
  /** Already running as an installed app. */
  | "installed"
  /** No prompt offered (yet), and not iOS — nothing useful to show. */
  | "unavailable";

interface State {
  support: InstallSupport;
}

/**
 * Holds the browser's install offer for the whole session.
 *
 * The offer arrives once, early, as a `beforeinstallprompt` event, and is lost
 * unless something captures it. The banner used to be that something — and it
 * skipped listening entirely once dismissed, so anyone who closed it could
 * never install again and had nowhere to go looking. Capturing here instead
 * means the offer survives the banner, and any screen can act on it.
 */
let deferred: BeforeInstallPromptEvent | null = null;
let state: State = { support: "unavailable" };
const listeners = new Set<() => void>();
let started = false;

function set(next: State) {
  if (next.support === state.support) return;
  state = next;
  for (const l of listeners) l();
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    // iOS Safari reports it here rather than through display-mode.
    (window.navigator as unknown as { standalone?: boolean }).standalone === true
  );
}

export function isIosSafari(): boolean {
  if (typeof window === "undefined") return false;
  const ua = window.navigator.userAgent;
  return (
    /iphone|ipad|ipod/i.test(ua) &&
    /safari/i.test(ua) &&
    !/crios|fxios|edgios/i.test(ua)
  );
}

function start() {
  if (started || typeof window === "undefined") return;
  started = true;

  if (isStandalone()) {
    set({ support: "installed" });
    return;
  }
  if (isIosSafari()) set({ support: "ios-manual" });

  window.addEventListener("beforeinstallprompt", (e: Event) => {
    // Holding it back is what makes installing available later, on demand,
    // instead of only in the moment the browser happened to offer it.
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
    set({ support: "ready" });
  });

  window.addEventListener("appinstalled", () => {
    deferred = null;
    set({ support: "installed" });
  });
}

function subscribe(cb: () => void): () => void {
  start();
  listeners.add(cb);
  return () => listeners.delete(cb);
}

/** Current installability, re-rendering when it changes. */
export function useInstallState(): InstallSupport {
  return useSyncExternalStore(
    subscribe,
    () => state.support,
    () => "unavailable" as const,
  );
}

/**
 * Show the browser's install dialog. Returns what the person chose, or
 * "unavailable" when there was no offer to show.
 */
export async function promptInstall(): Promise<
  "accepted" | "dismissed" | "unavailable"
> {
  if (!deferred) return "unavailable";
  const offer = deferred;
  try {
    await offer.prompt();
    const { outcome } = await offer.userChoice;
    if (outcome === "accepted") {
      // Chrome will not replay a used offer; `appinstalled` sets the final
      // state, this just stops us re-offering a prompt that is spent.
      deferred = null;
      set({ support: "installed" });
    }
    return outcome;
  } catch {
    return "unavailable";
  }
}
