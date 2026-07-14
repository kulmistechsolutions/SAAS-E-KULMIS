"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { SettingsInput } from "@/components/settings/settings-field";
import { SettingsSaveBar } from "@/components/settings/settings-save-bar";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { useSettingsSection } from "@/components/settings/use-settings-section";
import { getSettings, updateGrades } from "@/lib/settings/store";
import type { GradeBand } from "@/lib/settings/types";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";

export default function ExaminationSettingsPage() {
  const { draft, update, dirty, cancel, resetToDefault, save, saving } =
    useSettingsSection("examinations");
  const [grades, setGrades] = useState<GradeBand[]>(() => getSettings().grades);
  const [gradesDirty, setGradesDirty] = useState(false);

  function updateGrade(i: number, patch: Partial<GradeBand>) {
    setGrades((g) => g.map((row, idx) => (idx === i ? { ...row, ...patch } : row)));
    setGradesDirty(true);
  }

  function addGrade() {
    setGrades((g) => [...g, { min: 0, max: 0, grade: "" }]);
    setGradesDirty(true);
  }

  function removeGrade(i: number) {
    setGrades((g) => g.filter((_, idx) => idx !== i));
    setGradesDirty(true);
  }

  async function handleSave() {
    if (gradesDirty) {
      const gResult = await updateGrades(grades);
      if (!gResult.ok) {
        toast(gResult.error ?? "Invalid grade configuration", "error");
        return;
      }
      setGradesDirty(false);
    }
    await save();
  }

  const isDirty = dirty || gradesDirty;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Examination Settings</h1>
        <p className="mt-1 text-sm text-muted-foreground">Exams, results, portals, and grade scale.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <SettingsInput label="Maximum Terms" type="number" value={draft.maxTerms} onChange={(e) => update({ maxTerms: Number(e.target.value) })} />
        <SettingsInput label="Default Exam Status" value={draft.defaultExamStatus} onChange={(e) => update({ defaultExamStatus: e.target.value })} />
        <SettingsInput label="Passing Percentage" type="number" value={draft.passingPercentage} onChange={(e) => update({ passingPercentage: Number(e.target.value) })} />
      </div>

      <div className="grid gap-2 sm:grid-cols-2">
        <SettingsToggle label="Result Publishing" checked={draft.resultPublishing} onChange={(v) => update({ resultPublishing: v })} />
        <SettingsToggle label="Result Locking" checked={draft.resultLocking} onChange={(v) => update({ resultLocking: v })} />
        <SettingsToggle label="Student Result Portal" checked={draft.studentResultPortal} onChange={(v) => update({ studentResultPortal: v })} />
        <SettingsToggle label="Parent Result Portal" checked={draft.parentResultPortal} onChange={(v) => update({ parentResultPortal: v })} />
        <SettingsToggle label="Public Result Portal" checked={draft.publicResultPortal} onChange={(v) => update({ publicResultPortal: v })} />
        <SettingsToggle label="Block Result Feature" checked={draft.blockResultFeature} onChange={(v) => update({ blockResultFeature: v })} />
      </div>

      <div className="rounded-xl border bg-card p-5">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-semibold">Grade Configuration</h2>
          <Button variant="outline" className="h-8" onClick={addGrade}>
            <Plus className="mr-1 h-4 w-4" /> Add band
          </Button>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left">
              <th className="px-2 py-2">Minimum</th>
              <th className="px-2 py-2">Maximum</th>
              <th className="px-2 py-2">Grade</th>
              <th className="px-2 py-2" />
            </tr>
          </thead>
          <tbody>
            {grades.map((g, i) => (
              <tr key={i} className="border-b">
                <td className="px-2 py-2"><input type="number" className="w-20 rounded border px-2 py-1" value={g.min} onChange={(e) => updateGrade(i, { min: Number(e.target.value) })} /></td>
                <td className="px-2 py-2"><input type="number" className="w-20 rounded border px-2 py-1" value={g.max} onChange={(e) => updateGrade(i, { max: Number(e.target.value) })} /></td>
                <td className="px-2 py-2"><input className="w-16 rounded border px-2 py-1" value={g.grade} onChange={(e) => updateGrade(i, { grade: e.target.value })} /></td>
                <td className="px-2 py-2"><button type="button" onClick={() => removeGrade(i)} className="text-destructive"><Trash2 className="h-4 w-4" /></button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SettingsSaveBar dirty={isDirty} saving={saving} onSave={handleSave} onCancel={() => { cancel(); setGrades(getSettings().grades); setGradesDirty(false); }} onResetDefault={resetToDefault} />
    </div>
  );
}
