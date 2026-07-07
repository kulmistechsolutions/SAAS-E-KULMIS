"use client";

import { useParams } from "next/navigation";
import { notFound } from "next/navigation";
import { ReportPageShell } from "@/components/reports/report-page-shell";
import { getCategory, getReport } from "@/lib/reports/catalog";

export default function ReportViewPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const slug = params.slug as string;

  const category = getCategory(categoryId);
  const report = getReport(categoryId, slug);

  if (!category || !report) {
    notFound();
  }

  return (
    <ReportPageShell
      categoryId={categoryId}
      categoryLabel={category.label}
      report={report}
    />
  );
}
