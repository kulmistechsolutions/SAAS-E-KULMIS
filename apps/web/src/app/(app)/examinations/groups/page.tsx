"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createExamGroup, useExaminationsState } from "@/lib/examinations/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { toast } from "@/lib/toast";

export default function ExamGroupsPage() {
  const { examGroups, exams } = useExaminationsState();
  const [name, setName] = useState("");
  const { year, setYear } = useAcademicYearSelect("exam-groups-year");
  const [desc, setDesc] = useState("");

  async function handleCreate() {
    if (!name.trim()) {
      toast("Group name required", "error");
      return;
    }
    const res = await createExamGroup(name.trim(), year, desc || undefined);
    if (!res.ok) {
      toast(res.error ?? "Failed to create group", "error");
      return;
    }
    toast("Exam group created", "success");
    setName("");
    setDesc("");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exam Groups</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Combine multiple examinations into weighted final results.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">Create Group</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label required>Group Name</Label>
              <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Academic Final" />
            </div>
            <div>
              <Label>Academic Year</Label>
              <AcademicYearSelect className="mt-1.5" value={year} onChange={setYear} />
            </div>
            <div>
              <Label>Description</Label>
              <Input className="mt-1.5" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <Button onClick={handleCreate}>Create Group</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <p className="border-b px-5 py-3 font-semibold">Existing Groups</p>
          <ul className="divide-y">
            {examGroups.map((g) => {
              const count = exams.filter((e) => e.examGroupId === g.id).length;
              return (
                <li key={g.id} className="px-5 py-4">
                  <p className="font-medium">{g.name}</p>
                  <p className="text-sm text-muted-foreground">{g.academicYear} · {count} exam(s)</p>
                  {g.description && (
                    <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}
