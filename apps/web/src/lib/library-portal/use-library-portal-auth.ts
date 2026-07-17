"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiLibraryPortalMe, getLibraryPortalToken, type LibraryPortalMe } from "./api";

/** Redirects to the sign-in page when there's no token or it's expired/invalid. */
export function useLibraryPortalAuth() {
  const router = useRouter();
  const [me, setMe] = useState<LibraryPortalMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!getLibraryPortalToken()) {
      router.replace("/library-portal/login");
      return;
    }
    void apiLibraryPortalMe()
      .then((res) => {
        if (!cancelled) {
          setMe(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/library-portal/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, loading };
}
