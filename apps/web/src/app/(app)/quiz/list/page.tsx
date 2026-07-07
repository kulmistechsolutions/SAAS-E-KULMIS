"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Pagination } from "@/components/ui/pagination";
import { Select } from "@/components/ui/select";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import { QUIZ_STATUSES } from "@/lib/quiz/format";
import { deleteQuiz, listQuizzes, useQuizState } from "@/lib/quiz/store";
import type { QuizStatus } from "@/lib/quiz/types";
import { toast } from "@/lib/toast";

const PAGE_SIZE = 15;

export default function QuizListPage() {
  const [mounted, setMounted] = useState(false);
  const state = useQuizState();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState<QuizStatus | "">("");
  const [page, setPage] = useState(1);

  useEffect(() => setMounted(true), []);

  const rows = useMemo(
    () => (mounted ? listQuizzes({ search, status: status || undefined }) : []),
    [mounted, search, status, state],
  );
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (!mounted) return null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">All Quizzes</h1>
          <p className="mt-1 text-sm text-muted-foreground">Manage quizzes across the school.</p>
        </div>
        <Link href="/quiz/create"><Button className="h-9"><Plus className="mr-2 h-4 w-4" />Create</Button></Link>
      </div>

      <div className="flex flex-wrap gap-3">
        <Input placeholder="Search quiz, teacher, subject…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }} className="h-9 max-w-xs" />
        <Select value={status} onChange={(e) => { setStatus(e.target.value as QuizStatus | ""); setPage(1); }} className="h-9 min-w-[140px]">
          <option value="">All statuses</option>
          {QUIZ_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
        </Select>
      </div>

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <table className="w-full min-w-[900px] text-sm">
          <thead className="sticky top-0 bg-secondary text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-2.5">Code</th>
              <th className="px-4 py-2.5">Title</th>
              <th className="px-4 py-2.5">Teacher</th>
              <th className="px-4 py-2.5">Class</th>
              <th className="px-4 py-2.5">Subject</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="px-4 py-2.5 font-mono text-xs">{r.code}</td>
                <td className="px-4 py-2.5 font-medium">{r.title}</td>
                <td className="px-4 py-2.5">{r.teacherName}</td>
                <td className="px-4 py-2.5">{r.className} — {r.section}</td>
                <td className="px-4 py-2.5">{r.subject}</td>
                <td className="px-4 py-2.5"><QuizStatusBadge status={r.status} /></td>
                <td className="px-4 py-2.5">
                  <div className="flex gap-1">
                    <Link href={`/quiz/${r.id}`} className="inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-secondary"><Eye className="h-4 w-4" /></Link>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => { deleteQuiz(r.id); toast("Quiz deleted", "success"); }}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length > PAGE_SIZE && (
          <div className="border-t px-4 py-3">
            <Pagination page={page} pageCount={Math.ceil(rows.length / PAGE_SIZE)} total={rows.length} pageSize={PAGE_SIZE} onPageChange={setPage} />
          </div>
        )}
      </div>
    </div>
  );
}
