"use client";

import { useState } from "react";
import { GraduationCap, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useSchoolBranding } from "@/lib/settings/use-school-branding";
import { lookupPublicResults } from "@/lib/examinations/store";
import type { StudentExamResult, StudentFinalResult } from "@/lib/examinations/types";
import { toast } from "@/lib/toast";

export default function PublicResultsPage() {
  const branding = useSchoolBranding();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [termResults, setTermResults] = useState<StudentExamResult[]>([]);
  const [finalResult, setFinalResult] = useState<StudentFinalResult | null>(null);
  const [searched, setSearched] = useState(false);
  const [notFound, setNotFound] = useState(false);

  async function handleSearch() {
    if (!code.trim()) return;
    setLoading(true);
    setSearched(true);
    setNotFound(false);
    setBlocked(false);
    setTermResults([]);
    setFinalResult(null);

    const res = await lookupPublicResults(code.trim());
    setLoading(false);

    if (!res.ok) {
      setNotFound(true);
      toast(res.error ?? "Student ID not found.", "error");
      return;
    }
    if (res.blocked) {
      setBlocked(true);
      return;
    }
    if (res.result) {
      setTermResults(res.result.termResults);
      setFinalResult(res.result);
    }
  }

  const student = finalResult;

  return (
    <main className="min-h-screen bg-secondary/30 p-4 sm:p-8">
      <div className="mx-auto max-w-3xl">
        <div className="mb-8 text-center">
          {branding.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={branding.logoUrl}
              alt={branding.name}
              className="mx-auto mb-4 h-14 w-14 rounded-2xl object-cover shadow-lg"
            />
          ) : (
            <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg">
              <GraduationCap className="h-7 w-7" />
            </span>
          )}
          <h1 className="text-2xl font-bold">{branding.name}</h1>
          <p className="text-sm text-muted-foreground">{branding.tagline}</p>
          <p className="mt-2 text-lg font-semibold">Student Results Portal</p>
        </div>

        <div className="rounded-2xl border bg-card p-6 shadow-sm">
          <label className="mb-2 block text-sm font-medium">Enter Student ID</label>
          <div className="flex gap-2">
            <Input
              placeholder="e.g. SHMM000001"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setSearched(false);
              }}
              onKeyDown={(e) => e.key === "Enter" && void handleSearch()}
            />
            <Button onClick={() => void handleSearch()} disabled={loading}>
              <Search className="mr-2 h-4 w-4" />
              {loading ? "Loading…" : "View Results"}
            </Button>
          </div>
        </div>

        {searched && notFound && (
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
              <h2 className="text-lg font-bold">{student.studentName}</h2>
              <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                <div><dt className="text-muted-foreground">Student ID</dt><dd className="font-medium">{student.studentCode}</dd></div>
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
