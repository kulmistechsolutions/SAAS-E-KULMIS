"use client";


import { useT } from "@/lib/i18n/provider";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ExamCreationWizard } from "@/components/examinations/exam-creation-wizard";

export default function CreateExamPage() {
  const t = useT();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/examinations"
          className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("examinationsCreate.examinations")}
        </Link>
      </div>
      <div>
        <h1 className="text-2xl font-bold">{t("examinationsCreate.createExamination")}</h1>
        <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
          {t("examinationsCreate.enterpriseExamCreationWorkflowSubjectsAre")}
        </p>
      </div>
      <ExamCreationWizard mode="admin" successHref="/examinations" />
    </div>
  );
}
