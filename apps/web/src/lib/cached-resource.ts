"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";

/**
 * What this screen showed last time, shown again immediately.
 *
 * Every page in the app fetches after it mounts, and until the answer arrives
 * it draws a skeleton. That is right the first time and wrong every time
 * after: a school clicking back to Fee Management is shown a shimmering
 * placeholder in place of figures the browser already had, and the page feels
 * slow while doing nothing but confirming what it already knew.
 *
 * So the answer is kept per URL for the life of the tab. A revisit renders the
 * previous figures on the first frame and refreshes behind them; only a URL
 * nobody has ever asked for gets a skeleton. The refresh still happens every
 * time — this is about what is on screen while it happens, never about showing
 * stale money and stopping.
 *
 * The cache is deliberately not persisted. Money that survived a page reload
 * would outlive the session it was true in, and a figure from yesterday
 * rendered as today's is worse than a skeleton.
 */
const cache = new Map<string, unknown>();

/** Forget everything cached. Called on sign-out: the next user is not this one. */
export function clearResourceCache(): void {
  cache.clear();
}

/** Drop one entry, for when an action has certainly changed the answer. */
export function invalidateResource(url: string): void {
  cache.delete(url);
}

export interface CachedResource<T> {
  data: T | null;
  /** True only when there is nothing to show yet — the honest skeleton case. */
  loading: boolean;
  /** True while refreshing over data already on screen. */
  refreshing: boolean;
  failed: boolean;
  reload: () => void;
}

export function useCachedResource<T>(
  url: string | null,
  deps: unknown[] = [],
): CachedResource<T> {
  const cached = url ? (cache.get(url) as T | undefined) : undefined;
  const [data, setData] = useState<T | null>(cached ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (!url) return;
    let alive = true;

    // Switching filters changes the URL, and the previous URL's answer is not
    // this one's — so show that URL's own cached answer if it has one, and a
    // skeleton only if it does not.
    const known = cache.get(url) as T | undefined;
    setData(known ?? null);
    setFailed(false);
    setRefreshing(true);

    api<T>(url)
      .then((d) => {
        if (!alive) return;
        cache.set(url, d);
        setData(d);
      })
      .catch(() => {
        if (!alive) return;
        // A failed refresh keeps whatever is on screen: the figures were true
        // a moment ago, and blanking them because the network blinked tells
        // the school something false about its own money.
        if (cache.get(url) === undefined) setFailed(true);
      })
      .finally(() => {
        if (alive) setRefreshing(false);
      });

    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, nonce, ...deps]);

  return {
    data,
    loading: data === null && !failed,
    refreshing,
    failed: failed && data === null,
    reload: () => setNonce((n) => n + 1),
  };
}
