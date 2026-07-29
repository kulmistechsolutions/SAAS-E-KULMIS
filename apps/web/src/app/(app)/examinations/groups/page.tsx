"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  assignExamGroup,
  createExamGroup,
  useExaminationsState,
} from "@/lib/examinations/store";
import { AcademicYearSelect } from "@/components/academics/academic-year-select";
import { useAcademicYearSelect } from "@/lib/academics/year-select";
import { toast } from "@/lib/toast";

export default function ExamGroupsPage() {
  const t = useT();
  const { examGroups, exams } = useExaminationsState();
  const [name, setName] = useState("");
  const { year, setYear } = useAcademicYearSelect("exam-groups-year");
  const [desc, setDesc] = useState("");
  const [managingGroupId, setManagingGroupId] = useState<string | null>(null);
  const [termFilter, setTermFilter] = useState("");
  const [selectedExamIds, setSelectedExamIds] = useState<Set<string>>(new Set());
  const [adding, setAdding] = useState(false);

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

  const managingGroup = examGroups.find((g) => g.id === managingGroupId) ?? null;

  const groupExams = useMemo(
    () => (managingGroup ? exams.filter((e) => e.examGroupId === managingGroup.id) : []),
    [exams, managingGroup],
  );

  const addableExams = useMemo(() => {
    if (!managingGroup) return [];
    return exams.filter(
      (e) =>
        e.academicYear === managingGroup.academicYear &&
        e.examGroupId !== managingGroup.id &&
        (!termFilter || e.term === termFilter),
    );
  }, [exams, managingGroup, termFilter]);

  const availableTerms = useMemo(() => {
    if (!managingGroup) return [];
    const terms = new Set(
      exams.filter((e) => e.academicYear === managingGroup.academicYear).map((e) => e.term),
    );
    return [...terms].sort();
  }, [exams, managingGroup]);

  function openManage(groupId: string) {
    setManagingGroupId(groupId === managingGroupId ? null : groupId);
    setTermFilter("");
    setSelectedExamIds(new Set());
  }

  function toggleExamSelected(examId: string) {
    setSelectedExamIds((prev) => {
      const next = new Set(prev);
      if (next.has(examId)) next.delete(examId);
      else next.add(examId);
      return next;
    });
  }

  async function handleAddSelected() {
    if (!managingGroup || selectedExamIds.size === 0) return;
    setAdding(true);
    const ids = [...selectedExamIds];
    const results = await Promise.all(
      ids.map((examId) => assignExamGroup(examId, managingGroup.id)),
    );
    setAdding(false);
    const failed = results.filter((r) => !r.ok).length;
    if (failed > 0) {
      toast(`Added ${ids.length - failed}, ${failed} failed`, "error");
    } else {
      toast(`Added ${ids.length} exam(s) to ${managingGroup.name}`, "success");
    }
    setSelectedExamIds(new Set());
  }

  async function handleRemoveFromGroup(examId: string) {
    const res = await assignExamGroup(examId, null);
    if (!res.ok) toast(res.error ?? "Failed to remove exam from group", "error");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("examinationsGroups.examGroups")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("examinationsGroups.combineMultipleExaminationsIntoWeightedFinal")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="font-semibold">{t("examinationsGroups.createGroup")}</h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label required>{t("examinationsGroups.groupName")}</Label>
              <Input className="mt-1.5" value={name} onChange={(e) => setName(e.target.value)} placeholder={t("examinationsGroups.eGAcademicFinal")} />
            </div>
            <div>
              <Label>{t("examinationsGroups.academicYear")}</Label>
              <AcademicYearSelect className="mt-1.5" value={year} onChange={setYear} />
            </div>
            <div>
              <Label>{t("examinationsGroups.description")}</Label>
              <Input className="mt-1.5" value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <Button onClick={handleCreate}>{t("examinationsGroups.createGroup")}</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm lg:col-span-2">
          <p className="border-b px-5 py-3 font-semibold">{t("examinationsGroups.existingGroups")}</p>
          <ul className="divide-y">
            {examGroups.map((g) => {
              const count = exams.filter((e) => e.examGroupId === g.id).length;
              const isOpen = managingGroupId === g.id;
              return (
                <li key={g.id} className="px-5 py-4">
                  <div className="flex items-center justify-between gap-4">
                    <div>
                      <p className="font-medium">{g.name}</p>
                      <p className="text-sm text-muted-foreground">{g.academicYear} · {count} {t("examinationsGroups.examS")}</p>
                      {g.description && (
                        <p className="mt-1 text-xs text-muted-foreground">{g.description}</p>
                      )}
                    </div>
                    <Button variant="outline" onClick={() => openManage(g.id)}>
                      {isOpen ? t("examinationsGroups.close") : t("examinationsGroups.manageExams")}
                    </Button>
                  </div>

                  {isOpen && (
                    <div className="mt-4 grid gap-4 rounded-xl border bg-secondary/30 p-4 sm:grid-cols-2">
                      <div>
                        <p className="mb-2 text-sm font-medium">{t("examinationsGroups.inThisGroup")}</p>
                        {groupExams.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("examinationsGroups.noExamsYet")}</p>
                        ) : (
                          <ul className="max-h-64 space-y-1 overflow-y-auto">
                            {groupExams.map((e) => (
                              <li
                                key={e.id}
                                className="flex items-center justify-between gap-2 rounded-lg border bg-card px-3 py-2 text-xs"
                              >
                                <span>
                                  {e.name} — {e.term} · {e.className} {e.section}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromGroup(e.id)}
                                  className="text-muted-foreground hover:text-destructive"
                                >
                                  {t("examinationsGroups.remove")}
                                </button>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>

                      <div>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <p className="text-sm font-medium">{t("examinationsGroups.addExams")}</p>
                          <Select
                            className="h-8 w-auto text-xs"
                            value={termFilter}
                            onChange={(e) => setTermFilter(e.target.value)}
                          >
                            <option value="">{t("examinationsGroups.allTerms")}</option>
                            {availableTerms.map((term) => (
                              <option key={term} value={term}>{term}</option>
                            ))}
                          </Select>
                        </div>
                        {addableExams.length === 0 ? (
                          <p className="text-xs text-muted-foreground">{t("examinationsGroups.noExamsAvailable")}</p>
                        ) : (
                          <ul className="max-h-64 space-y-1 overflow-y-auto">
                            {addableExams.map((e) => (
                              <li key={e.id}>
                                <label className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-xs">
                                  <input
                                    type="checkbox"
                                    checked={selectedExamIds.has(e.id)}
                                    onChange={() => toggleExamSelected(e.id)}
                                  />
                                  <span>
                                    {e.name} — {e.term} · {e.className} {e.section}
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        )}
                        <Button
                          className="mt-3"
                          disabled={selectedExamIds.size === 0 || adding}
                          onClick={handleAddSelected}
                        >
                          {adding
                            ? "…"
                            : `${t("examinationsGroups.addSelected")} (${selectedExamIds.size})`}
                        </Button>
                      </div>
                    </div>
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
