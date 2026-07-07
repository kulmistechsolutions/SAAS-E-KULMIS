"use client";

import { useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { BRAND } from "@/lib/brand";
import { SCHOOL } from "@/lib/students/constants";
import {
  isStudentBlocked,
  lookupStudentByCode,
  studentFinalResult,
  studentPublishedResults,
} from "@/lib/examinations/store";

export default function PublicResultsPage() {
  const [code, setCode] = useState("");
  const [searched, setSearched] = useState(false);
  const student = searched && code ? lookupStudentByCode(code) : undefined;
  const blocked = student ? isStudentBlocked(student.id) : false;
  const termResults = student && !blocked ? studentPublishedResults(student.id) : [];
  const finalResult = student && !blocked ? studentFinalResult(student.id) : null;

  function handleSearch() {
    setSearched(true);
  }

  return (
    <main className="min-h-screen bg-secondary/30 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
            <GraduationCap className="h-7 w-7" />
          </span>
          <h1 className="text-2xl font-bold">{SCHOOL.name}</h1>
          <p className="text-sm text-muted-foreground">{BRAND.tagline}</p>
          <p className="mt-2 text-lg font-semibold">Student Results Portal</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium">Enter Student ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. SHMM000001"
              value={code}
              onChange={(e) => { setCode(e.target.value); setSearched(false); }}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <Button onClick={handleSearch}>
              <Search className="mr-2 h-4 w-4" />
              View Results
            </Button>
          </div>
        </div>

        {searched && !student && (
          <p className="mt-6 text-center text-rose-600">Student ID not found.</p>
        )}

        {student && blocked && (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-6 text-center text-rose-700 dark:border-rose-900 dark:bg-rose-950/30">
            Results are blocked. Please contact the school office.
          </div>
        )}

        {student && !blocked && (
          <div className="mt-6 space-y-6">
            <div className="rounded-2xl border bg-card p-6 shadow-sm">
              <h2 className="text-lg font-bold">{student.fullName}</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Student ID</dt><dd className="font-medium">{student.code}</dd></div>
                <div><dt className="text-muted-foreground">Class</dt><dd className="font-medium">{student.className}</dd></div>
                <div><dt className="text-muted-foreground">Section</dt><dd className="font-medium">{student.section ?? "—"}</dd></div>
                <div><dt className="text-muted-foreground">Academic Year</dt><dd className="font-medium">{student.academicYear}</dd></div>
              </dl>
            </div>

            {termResults.map((tr) => (
              <div key={tr.examId} className="rounded-2xl border bg-card shadow-sm">
                <div className="border-b px-5 py-3">
                  <h3 className="font-semibold">{tr.examName}</h3>
                  <p className="text-sm text-muted-foreground">{tr.term} · Weight {tr.weightPercent}%</p>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-secondary text-left text-xs text-muted-foreground">
                    <tr>
                      <th className="px-4 py-2 font-medium">Subject</th>
                      <th className="px-4 py-2 font-medium">Max</th>
                      <th className="px-4 py-2 font-medium">Obtained</th>
                      <th className="px-4 py-2 font-medium">Grade</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tr.subjects.map((s) => (
                      <tr key={s.subject} className="border-t">
                        <td className="px-4 py-2">{s.subject}</td>
                        <td className="px-4 py-2 tabular-nums">{s.maxMarks}</td>
                        <td className="px-4 py-2 tabular-nums">{s.marksObtained}</td>
                        <td className="px-4 py-2 font-semibold">{s.grade}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="flex flex-wrap gap-4 border-t px-5 py-3 text-sm">
                  <span>Average: <strong>{tr.average.toFixed(1)}</strong></span>
                  <span>Grade: <strong>{tr.grade}</strong></span>
                  <Badge tone={tr.passed ? "success" : "danger"}>{tr.passed ? "Pass" : "Fail"}</Badge>
                </div>
              </div>
            ))}

            {finalResult && (
              <div className="rounded-2xl border-2 border-primary/20 bg-primary/5 p-6">
                <h3 className="font-semibold">Final Academic Result</h3>
                <p className="mt-2 text-3xl font-bold text-primary">
                  {finalResult.finalGrade} · {finalResult.finalAverage.toFixed(1)}%
                </p>
                <Badge tone={finalResult.passed ? "success" : "danger"} className="mt-2">
                  {finalResult.passed ? "PASS" : "FAIL"}
                </Badge>
                <p className="mt-3 text-xs text-muted-foreground">
                  Calculated from weighted term marks. Final % = Σ(weighted marks) ÷ Σ(weights).
                </p>
              </div>
            )}

            {termResults.length === 0 && (
              <p className="text-center text-muted-foreground">No published results yet.</p>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
