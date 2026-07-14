"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExamCreationWizard } from "@/components/examinations/exam-creation-wizard";

export default function CreateExamPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/examinations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Examinations
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">Create Examination</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          Enterprise exam creation workflow — subjects are loaded automatically from
          teacher assignments. Supports multiple classes, sections, weighted terms,
          and school Excel import.
        </p>
      </div>
      <ExamCreationWizard mode="admin" successHref="/examinations" />
    </div>
  );
}
