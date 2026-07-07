"use client";

import { useState } from "react";
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
import { shortDate } from "@/lib/examinations/format";
import { toast } from "@/lib/toast";

export default function BlockedStudentsPage() {
  const { blockedStudents, exams } = useExaminationsState();
  const students = getStudentsState().students;
  const [search, setSearch] = useState("");
  const [studentId, setStudentId] = useState("");
  const [examId, setExamId] = useState("");
  const [reason, setReason] = useState("Outstanding Fees");

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

  function handleBlock() {
    if (!studentId) {
      toast("Select a student", "error");
      return;
    }
    const res = blockStudent(studentId, reason, examId || undefined);
    if (res.ok) toast("Student blocked", "success");
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Blocked Students</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Block students from viewing published results. Unblock restores access immediately.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <h2 className="flex items-center gap-2 font-semibold">
            <ShieldBan className="h-4 w-4 text-rose-500" />
            Block Student
          </h2>
          <div className="mt-4 space-y-4">
            <div>
              <Label required>Student</Label>
              <Select className="mt-1.5" value={studentId} onChange={(e) => setStudentId(e.target.value)}>
                <option value="">Select student…</option>
                {students.filter((s) => s.status === "ACTIVE").map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.fullName} ({s.code})
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label>Exam (optional)</Label>
              <Select className="mt-1.5" value={examId} onChange={(e) => setExamId(e.target.value)}>
                <option value="">All exams</option>
                {exams.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <Label required>Reason</Label>
              <Input className="mt-1.5" value={reason} onChange={(e) => setReason(e.target.value)} />
            </div>
            <Button onClick={handleBlock}>Block Student</Button>
          </div>
        </div>

        <div className="rounded-2xl border bg-card shadow-sm">
          <div className="flex items-center gap-2 border-b px-5 py-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search blocked students…"
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
                  <Button variant="outline" className="h-9 shrink-0" onClick={() => {
                    unblockStudent(b.id);
                    toast("Student unblocked", "success");
                  }}>
                    <ShieldCheck className="mr-2 h-4 w-4" />
                    Unblock
                  </Button>
                </li>
              );
            })}
            {filtered.length === 0 && (
              <li className="px-5 py-10 text-center text-muted-foreground">No blocked students.</li>
            )}
          </ul>
        </div>
      </div>
    </div>
  );
}
