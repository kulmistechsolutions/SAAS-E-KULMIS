"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileSpreadsheet,
  Loader2,
  Upload,
  XCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import {
  commitMarksFile,
  downloadMarksTemplate,
  fetchImportableExams,
  fileToBase64,
  validateMarksFile,
  type ImportPreview,
  type ImportableExam,
} from "@/lib/marks-import/api";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function labelOf(exam: ImportableExam): string {
  return exam.section
    ? `${exam.class.name} ${exam.section.name}`
    : exam.class.name;
}

/**
 * Bulk exam-marks import.
 *
 * Three steps, in the order a school actually works: pick the classes, take the
 * template away and fill it in, bring it back. Nothing is written until the
 * check comes back clean and the admin presses import — and if any sheet has a
 * problem, none of them are imported.
 */
export default function MarksImportPage() {
  const academics = useAcademicsState();
  const [yearId, setYearId] = useState("");
  const [exams, setExams] = useState<ImportableExam[]>([]);
  const [groupId, setGroupId] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [busy, setBusy] = useState<"none" | "checking" | "importing">("none");
  const [loading, setLoading] = useState(true);
  const fileInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  const years = academics.academicYears;
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId(years.find((y) => y.status === "ACTIVE")?.id ?? years[0]!.id);
  }, [years, yearId]);

  const reload = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      setExams(await fetchImportableExams(yearId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load exams", "error");
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // Exams are grouped so a school picks "Midterm 2026" and gets every class in
  // it, rather than hunting through a flat list of one exam per class.
  const groups = useMemo(() => {
    const map = new Map<string, { id: string; name: string; exams: ImportableExam[] }>();
    for (const exam of exams) {
      const id = exam.examGroup?.id ?? `solo:${exam.name}`;
      const name = exam.examGroup?.name ?? exam.name;
      const g = map.get(id);
      if (g) g.exams.push(exam);
      else map.set(id, { id, name, exams: [exam] });
    }
    return [...map.values()];
  }, [exams]);

  useEffect(() => {
    if (groupId || groups.length === 0) return;
    setGroupId(groups[0]!.id);
  }, [groups, groupId]);

  const group = groups.find((g) => g.id === groupId) ?? null;

  // Changing what is selected invalidates any preview built from the old set.
  useEffect(() => {
    setPreview(null);
  }, [groupId, picked]);

  useEffect(() => {
    if (!group) return;
    setPicked(new Set(group.exams.map((e) => e.id)));
  }, [group]);

  const selected = useMemo(
    () => (group ? group.exams.filter((e) => picked.has(e.id)) : []),
    [group, picked],
  );

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function handleTemplate() {
    if (selected.length === 0) return;
    try {
      await downloadMarksTemplate(
        selected.map((e) => e.id),
        `${(group?.name ?? "marks").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-template.xlsx`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not build template", "error");
    }
  }

  async function handleFile(f: File | null) {
    setPreview(null);
    if (!f) {
      setFile(null);
      return;
    }
    try {
      const base64 = await fileToBase64(f);
      setFile({ name: f.name, base64 });
      setBusy("checking");
      setPreview(await validateMarksFile(selected.map((e) => e.id), base64));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read that file", "error");
      setFile(null);
    } finally {
      setBusy("none");
    }
  }

  async function handleImport() {
    if (!file || !preview?.ok) return;
    setBusy("importing");
    try {
      const res = await commitMarksFile(selected.map((e) => e.id), file.base64);
      toast(`${res.imported} marks imported`, "success");
      setFile(null);
      setPreview(null);
      if (fileInput.current) fileInput.current.value = "";
    } catch (e) {
      toast(e instanceof Error ? e.message : "Import failed", "error");
    } finally {
      setBusy("none");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <FileSpreadsheet className="h-6 w-6" />
            Import Exam Marks
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Download a sheet per class, fill it in, bring it back.
          </p>
        </div>
        <div className="w-44">
          <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : groups.length === 0 ? (
        <p className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          No exams found for this academic year. Create an exam first.
        </p>
      ) : (
        <>
          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">1 · Choose the exam and classes</h2>
            <div className="w-72">
              <Select value={groupId} onChange={(e) => setGroupId(e.target.value)}>
                {groups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name} ({g.exams.length} class
                    {g.exams.length === 1 ? "" : "es"})
                  </option>
                ))}
              </Select>
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {group?.exams.map((exam) => (
                <label
                  key={exam.id}
                  className={cn(
                    "flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm transition-colors",
                    picked.has(exam.id) ? "border-primary bg-primary/5" : "hover:bg-secondary",
                  )}
                >
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={picked.has(exam.id)}
                    onChange={() => toggle(exam.id)}
                  />
                  <span>
                    <span className="font-medium">{labelOf(exam)}</span>
                    <span className="block text-xs text-muted-foreground">
                      {exam._count.subjects} subjects · out of {exam.maxMarks}
                    </span>
                  </span>
                </label>
              ))}
            </div>

            <p className="text-xs text-muted-foreground">
              All classes are selected by default — untick any you want to import
              separately.
            </p>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">2 · Download the template</h2>
            <p className="text-xs text-muted-foreground">
              One tab per class, with that class&apos;s own students and subjects.
              Total, average and grade fill in themselves.
            </p>
            <Button type="button" onClick={handleTemplate} disabled={selected.length === 0}>
              <Download className="mr-2 h-4 w-4" />
              Download template ({selected.length} class
              {selected.length === 1 ? "" : "es"})
            </Button>
          </section>

          <section className="space-y-3 rounded-lg border p-4">
            <h2 className="text-sm font-semibold">3 · Upload the filled-in file</h2>
            <input
              ref={fileInput}
              type="file"
              accept=".xlsx"
              onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
              className="block w-full text-sm file:mr-3 file:rounded-md file:border file:bg-secondary file:px-3 file:py-1.5 file:text-sm"
            />

            {busy === "checking" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking every sheet…
              </div>
            )}

            {preview && (
              <div className="space-y-3">
                <div
                  className={cn(
                    "flex items-start gap-3 rounded-lg border p-3",
                    preview.ok
                      ? "border-emerald-500/40 bg-emerald-500/10"
                      : "border-rose-500/40 bg-rose-500/10",
                  )}
                >
                  {preview.ok ? (
                    <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600 dark:text-rose-400" />
                  )}
                  <div>
                    <p className="font-medium">
                      {preview.ok
                        ? `Ready — ${preview.totalMarks} marks across ${preview.sheets.length} class${preview.sheets.length === 1 ? "" : "es"}`
                        : `${preview.issues.length} problem${preview.issues.length === 1 ? "" : "s"} found`}
                    </p>
                    <p className="mt-0.5 text-sm text-muted-foreground">
                      {preview.ok
                        ? "Nothing has been saved yet."
                        : "Fix these in the file and upload it again. Nothing will be imported until every sheet is clean."}
                    </p>
                  </div>
                </div>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-secondary/40 text-left text-xs text-muted-foreground">
                        <th className="px-3 py-2 font-medium">Class</th>
                        <th className="px-3 py-2 font-medium">Students</th>
                        <th className="px-3 py-2 font-medium">Marks</th>
                        <th className="px-3 py-2 font-medium">Not entered</th>
                        <th className="px-3 py-2 font-medium">Problems</th>
                      </tr>
                    </thead>
                    <tbody>
                      {preview.sheets.map((s) => (
                        <tr key={s.examId} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{s.className}</td>
                          <td className="px-3 py-2">{s.students}</td>
                          <td className="px-3 py-2">{s.marks}</td>
                          <td className="px-3 py-2 text-muted-foreground">{s.blanks}</td>
                          <td className="px-3 py-2">
                            {s.issues.length === 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400">
                                none
                              </span>
                            ) : (
                              <span className="text-rose-600 dark:text-rose-400">
                                {s.issues.length}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {preview.issues.length > 0 && (
                  <ul className="max-h-72 space-y-1 overflow-y-auto">
                    {preview.issues.map((issue, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 rounded-lg border border-rose-500/30 bg-rose-500/5 px-3 py-2 text-sm"
                      >
                        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>
                          <span className="font-medium">{issue.sheet}</span>
                          {issue.row ? (
                            <span className="text-muted-foreground"> row {issue.row}</span>
                          ) : null}
                          {" — "}
                          {issue.message}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}

                <div className="flex justify-end">
                  <Button
                    type="button"
                    onClick={handleImport}
                    disabled={!preview.ok || busy !== "none"}
                  >
                    {busy === "importing" ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Upload className="mr-2 h-4 w-4" />
                    )}
                    Import {preview.totalMarks} marks
                  </Button>
                </div>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
