"use client";

import Link from "next/link";
import { useParams, notFound } from "next/navigation";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { getCategory } from "@/lib/reports/catalog";

export default function ReportCategoryPage() {
  const params = useParams();
  const categoryId = params.category as string;
  const category = getCategory(categoryId);

  if (!category) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <Link href="/reports" className="inline-flex items-center gap-1 text-sm text-primary hover:underline">
        <ArrowLeft className="h-4 w-4" /> Back to Reports Center
      </Link>

      <div>
        <h1 className="text-2xl font-bold">{category.label}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{category.description}</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {category.reports.map((report) => (
          <Link
            key={report.slug}
            href={`/reports/${categoryId}/${report.slug}`}
            className="group flex items-start justify-between gap-3 rounded-2xl border bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md"
          >
            <div>
              <p className="font-semibold group-hover:text-primary">{report.title}</p>
              <p className="mt-1 text-sm text-muted-foreground">{report.description}</p>
            </div>
            <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
          </Link>
        ))}
      </div>
    </div>
  );
}
