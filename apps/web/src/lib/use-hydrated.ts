"use client";

import { useEffect, useState } from "react";

/**
 * Has the browser taken over from the server-rendered HTML?
 *
 * Screens need this because they read stores backed by localStorage, which the
 * server cannot see: rendering that data on the first pass would disagree with
 * the HTML React is hydrating, and React would discard the tree. So every page
 * held a `mounted` flag and showed "Loading…" until its first effect ran.
 *
 * That is right exactly once. Hydration happens for the first document a tab
 * loads, and never again — a click from Students to Fee Management does not
 * re-hydrate anything. But `useState(false)` cannot tell the two apart, so
 * every page painted "Loading…" before painting itself, on every navigation,
 * for the whole life of the session. On a slow phone that is the flash a
 * school sees between every two screens of this product.
 *
 * The flag is remembered for the tab. The first page pays for hydration; every
 * page after it starts ready and renders its content on the first frame.
 */
let hydratedThisTab = false;

export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(hydratedThisTab);

  useEffect(() => {
    hydratedThisTab = true;
    if (!hydrated) setHydrated(true);
  }, [hydrated]);

  return hydrated;
}
