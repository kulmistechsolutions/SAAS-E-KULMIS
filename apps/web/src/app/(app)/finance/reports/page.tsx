"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * This page used to be its own report list, but every card either linked to
 * itself ("Collection by Class"/"Collection by Section" both pointed right
 * back here — clicking did nothing) or to a page with no report-specific
 * view at all. The real fee reports — 15 of them, each with working filters,
 * print/PDF/CSV, and (for the grouped ones) a chart — already live in the
 * Reports Center. Redirecting here keeps the old /finance/reports link
 * working for anyone who has it bookmarked, without maintaining two parallel
 * lists of the same reports.
 */
export default function FeeReportsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/reports/fees");
  }, [router]);
  return null;
}
