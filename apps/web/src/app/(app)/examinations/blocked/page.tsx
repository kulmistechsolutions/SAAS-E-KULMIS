"use client";


import { useT } from "@/lib/i18n/provider";
import { useMemo, useState } from "react";
import { Search, ShieldBan, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  blockStudent,
  unblockStudent,
  useExaminationsState,
} from "@/lib/examinations/store";
import { getState as getStudentsState } from "@/lib/students/store";
import {
  activeAcademicYear,
  classNamesForYear,
  groupClassNames,
  useAcademicsState,
} from "@/lib/academics/store";
import { shortDate } from "@/lib/examinations/format";
import { toast } from "@/lib/toast";

export default function BlockedStudentsPage() {
  const t = useT();
  const { blockedStudents, exams } = useExaminationsState();
  const academics = useAcademicsState();
  const students = getStudentsState().students;
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [studentSearch, setStudentSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [reason, setReason] = useState("Outstanding Fees");

  const year = activeAcademicYear();
  const classOptions = useMemo(() => classNamesForYear(year), [year, academics.classes]);
  const classGroups = useMemo(
    () => groupClassNames(classOptions, year, t("common.defaultGrades")),
    [classOptions, year, academics.structureTrees, t],
  );

  const blockableStudents = useMemo(() => {
    const q = studentSearch.trim().toLowerCase();
    return students.filter((s) => {
      if (s.status !== "ACTIVE") return false;
      if (classFilter && s.className !== classFilter) return false;
      if (
        q &&
        !s.fullName.toLowerCase().includes(q) &&
        !s.code.toLowerCase().includes(q)
      ) {
        return false;
      }
      return true;
    });
  }, [students, classFilter, studentSearch]);

  const filtered = blockedStudents.filter((b) => {
    const st = students.find((s) => s.id === b.studentId);
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      st?.fullName.toLowerCase().includes(q) ||
      st?.code.toLowerCase().includes(q) ||
      b.reason.toLowerCase().includes(q)
    );
  });

  async function handleBlock() {
    if (!studentId) {
      toast("Select a student", "error");
      return;
    }
    const res = await blockStudent(studentId, reason, examId || undefined);
    if (res.ok) toast("Student blocked", "success");
    else toast(res.error ?? "Failed to block", "error");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("examinationsBlocked.blockedStudents")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("examinationsBlocked.blockStudentsFromViewingPublishedResults")}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldBan className="h-4 w-4 text-rose-500" />
            {t("examinationsBlocked.blockStudent")}
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label>{t("examinationsBlocked.class")}</Label>
              <Select
                className="mt-1.5"
                value={classFilter}
                onChange={(e) => {
                  setClassFilter(e.target.value);
                  setStudentId("");
                }}
              >
                <option value="">{t("examinationsBlocked.allClasses")}</option>
                {classGroups.map((g) =>
                  g.label === null ? (
                    g.names.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))
                  ) : (
                    <optgroup key={g.label} label={g.label}>
                      {g.names.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </optgroup>
                  ),
                )}
              </Select>
            </div>
            <div>
              <Label>{t("examinationsBlocked.searchStudent")}</Label>
              <div className="relative mt-1.5">
                <Search className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  className="ps-9"
                  placeholder={t("examinationsBlocked.nameOrId")}
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                />
              </div>
            </div>
            <div>
              <Label required>{t("examinationsBlocked.student")}</Label>
              <Select className="mt-1.5" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">{t("examinationsBlocked.selectStudent")}</option>
                {blockableStudents.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.code}) — {s.className}
                  </option>
                ))}
              </Select>
              {blockableStudents.length === 0 && (
                <p className="mt-1 text-xs text-muted-foreground">
                  {t("examinationsBlocked.noStudentsMatch")}
                </p>
              )}
            </div>
            <div>
              <Label>{t("examinationsBlocked.examOptional")}</Label>
              <Select className="mt-1.5" value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">{t("examinationsBlocked.allExams")}</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label required>{t("examinationsBlocked.reason")}</Label>
              <Input className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button onClick={handleBlock}>{t("examinationsBlocked.blockStudent")}</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("examinationsBlocked.searchBlockedStudents")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="border-0 shadow-none focus-visible:ring-0"
            />
          </div>
          <ul className="divide-y">
            {filtered.map((b) => {
              const st = students.find((s) => s.id === b.studentId);
              const ex = b.examId ? exams.find((e) => e.id === b.examId) : null;
              return (
                <li key={b.id} className="flex items-center justify-between gap-4 px-5 py-4">
                  <div>
                    <p className="font-medium">{st?.fullName ?? "Unknown"}</p>
                    <p className="text-sm text-rose-600">{b.reason}</p>
                    <p className="text-xs text-muted-foreground">
                      {ex?.name ?? "All exams"} · {shortDate(b.blockedAt)}
                    </p>
                  </div>
                  <Button variant="outline" className="h-9 shrink-0" onClick={async () => {
                    const res = await unblockStudent(b.id);
                    if (res.ok) toast("Student unblocked", "success");
                    else toast(res.error ?? "Failed to unblock", "error");
                  }}>
                    <ShieldCheck className="me-2 h-4 w-4" />
                    {t("examinationsBlocked.unblock")}
                  </Button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-5 py-10 text-center text-muted-foreground">{t("examinationsBlocked.noBlockedStudents")}</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
