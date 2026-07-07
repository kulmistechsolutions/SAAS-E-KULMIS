"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ExamFormDialog } from "@/components/examinations/exam-form-dialog";

export default function CreateExamPage() {
  const [open, setOpen] = useState(true);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create Examination</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Subjects load automatically from teacher assignments per class and section.
          </p>
        </div>
        <Button onClick={() => setOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Exam
        </Button>
      </div>
      <div className="rounded-2xl border border-dashed bg-card p-12 text-center text-muted-foreground">
        <p>Use the form to create examinations for one or multiple classes and sections.</p>
        <Button className="mt-4" onClick={() => setOpen(true)}>
          Open Create Form
        </Button>
      </div>
      <ExamFormDialog open={open} onClose={() => setOpen(false)} />
    </div>
  );
}
