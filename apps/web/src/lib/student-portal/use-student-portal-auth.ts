"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  apiStudentPortalMe,
  getStudentPortalToken,
  type StudentPortalMe,
} from "./api";

/** Redirects to the sign-in page when there's no token or it's expired/invalid. */
export function useStudentPortalAuth() {
  const router = useRouter();
  const [me, setMe] = useState<StudentPortalMe | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!getStudentPortalToken()) {
      router.replace("/student-portal/login");
      return;
    }
    void apiStudentPortalMe()
      .then((res) => {
        if (!cancelled) {
          setMe(res);
          setLoading(false);
        }
      })
      .catch(() => {
        if (!cancelled) router.replace("/student-portal/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return { me, loading };
}
