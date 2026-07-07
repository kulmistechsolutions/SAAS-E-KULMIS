"use client";

import { use, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import {
  closeQuiz,
  deleteQuestion,
  getQuiz,
  publishQuiz,
  quickAddMcq,
} from "@/lib/quiz/store";
import { questionTypeLabel, shortDate } from "@/lib/quiz/format";
import { toast } from "@/lib/toast";

export default function QuizDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const quiz = useMemo(() => getQuiz(id), [id]);
  const [qText, setQText] = useState("");
  const [qMarks, setQMarks] = useState("5");

  if (!quiz) {
    return <p className="text-muted-foreground">Quiz not found.</p>;
  }

  function copyLink() {
    const url = `${window.location.origin}${quiz!.linkPath}`;
    navigator.clipboard.writeText(url);
    toast("Quiz link copied", "success");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <Link href="/quiz/list" className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />All Quizzes
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{quiz.title}</h1>
          <p className="mt-1 font-mono text-sm text-muted-foreground">{quiz.code}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={copyLink}><Copy className="mr-2 h-4 w-4" />Copy Link</Button>
          <Link href={quiz.linkPath}><Button variant="outline" className="h-9"><Play className="mr-2 h-4 w-4" />Preview</Button></Link>
          <Link href={`/quiz/${quiz.id}/results`}><Button variant="outline" className="h-9">Results</Button></Link>
          {quiz.status === "DRAFT" && (
            <Button className="h-9" onClick={() => { const r = publishQuiz(quiz.id); toast(r.ok ? "Published" : r.error ?? "Failed", r.ok ? "success" : "error"); }}>
              Publish
            </Button>
          )}
          {quiz.status === "ACTIVE" && (
            <Button variant="outline" className="h-9" onClick={() => { closeQuiz(quiz.id); toast("Quiz closed", "success"); }}>
              Close
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={<QuizStatusBadge status={quiz.status} />} />
        <Stat label="Class / Section" value={`${quiz.className} — ${quiz.section}`} />
        <Stat label="Subject" value={quiz.subject} />
        <Stat label="Duration" value={`${quiz.durationMinutes} min`} />
        <Stat label="Total Marks" value={String(quiz.totalMarks)} />
        <Stat label="Questions" value={String(quiz.questions.length)} />
        <Stat label="Window" value={`${shortDate(quiz.startDate)} – ${shortDate(quiz.endDate)}`} />
        <Stat label="Max Attempts" value={String(quiz.maxAttempts)} />
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Quiz Builder</h2>
        <p className="mt-1 text-sm text-muted-foreground">{quiz.description || "Add questions below."}</p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Input placeholder="Question text" value={qText} onChange={(e) => setQText(e.target.value)} className="h-9 max-w-md" />
          <Input type="number" value={qMarks} onChange={(e) => setQMarks(e.target.value)} className="h-9 w-20" />
          <Button
            className="h-9"
            onClick={() => {
              if (!qText.trim()) return;
              quickAddMcq(quiz.id, qText, Number(qMarks) || 5, ["Correct", "Wrong A", "Wrong B", "Wrong C"], 0);
              setQText("");
              toast("Question added", "success");
            }}
          >
            <Plus className="mr-2 h-4 w-4" />Add MCQ
          </Button>
        </div>

        <div className="mt-6 space-y-3">
          {quiz.questions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No questions yet.</p>
          ) : (
            quiz.questions
              .sort((a, b) => a.order - b.order)
              .map((q, i) => (
                <div key={q.id} className="flex items-start justify-between rounded-lg border bg-secondary/30 p-4">
                  <div>
                    <p className="text-xs text-muted-foreground">Q{i + 1} · {questionTypeLabel(q.type)} · {q.marks} marks</p>
                    <p className="mt-1 font-medium">{q.text}</p>
                  </div>
                  <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => { deleteQuestion(quiz.id, q.id); toast("Removed", "info"); }}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}
