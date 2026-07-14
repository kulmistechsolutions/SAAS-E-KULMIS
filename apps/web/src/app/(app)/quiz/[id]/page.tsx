"use client";

import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, Play, Plus, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import {
  apiGetQuiz,
  apiPublishQuiz,
  apiUpdateQuizBuilder,
  type ApiQuiz,
  type QuizBuilderQuestion,
} from "@/lib/quiz/api";
import { toast } from "@/lib/toast";

type QType = "MCQ" | "DIRECT" | "MATCH" | "FILL_BLANK";

interface BQ {
  key: string;
  question: string;
  questionType: QType;
  options: string[];
  correctAnswer: string;
  gradingMode: "EXACT" | "AI_CONCEPT";
  pairs: { left: string; right: string }[];
  blanks: string[];
  marks: number;
}

const TYPE_LABEL: Record<QType, string> = {
  MCQ: "Multiple Choice",
  DIRECT: "Direct Question",
  MATCH: "Match Pairs",
  FILL_BLANK: "Fill in the Blank",
};

let seq = 0;
const uid = () => `q_${Date.now()}_${seq++}`;

function blankQuestion(type: QType): BQ {
  return {
    key: uid(),
    question: "",
    questionType: type,
    options: type === "MCQ" ? ["", ""] : [],
    correctAnswer: "",
    gradingMode: "EXACT",
    pairs: type === "MATCH" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
    blanks: type === "FILL_BLANK" ? [""] : [],
    marks: 1,
  };
}

function toBQ(q: {
  question: string;
  questionType?: string;
  options: unknown;
  correctAnswer?: string;
  gradingMode?: "EXACT" | "AI_CONCEPT";
  pairs?: { left: string; right: string }[] | null;
  blanks?: string[] | null;
  marks: number;
}): BQ {
  const type = (q.questionType as QType) ?? "MCQ";
  return {
    key: uid(),
    question: q.question,
    questionType: ["MCQ", "DIRECT", "MATCH", "FILL_BLANK"].includes(type) ? type : "DIRECT",
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    correctAnswer: q.correctAnswer ?? "",
    gradingMode: q.gradingMode ?? "EXACT",
    pairs: q.pairs ?? [],
    blanks: q.blanks ?? [],
    marks: q.marks,
  };
}

function toPayload(qs: BQ[]): QuizBuilderQuestion[] {
  return qs.map((q) => ({
    question: q.question.trim(),
    questionType: q.questionType,
    options: q.questionType === "MCQ" ? q.options.filter((o) => o.trim()) : [],
    correctAnswer: q.correctAnswer,
    gradingMode: q.gradingMode,
    pairs: q.questionType === "MATCH" ? q.pairs.filter((p) => p.left.trim() && p.right.trim()) : [],
    blanks: q.questionType === "FILL_BLANK" ? q.blanks.filter((b) => b.trim()) : [],
    marks: q.marks,
  }));
}

export default function QuizBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const [quiz, setQuiz] = useState<ApiQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [questions, setQuestions] = useState<BQ[]>([]);
  const [instructions, setInstructions] = useState("");
  const [preventMinimize, setPreventMinimize] = useState(false);
  const [disableCopyPaste, setDisableCopyPaste] = useState(false);
  const [resetOnMinimize, setResetOnMinimize] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [duration, setDuration] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [addType, setAddType] = useState<QType>("MCQ");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = await apiGetQuiz(id);
      setQuiz(q);
      setQuestions((q.questions ?? []).map(toBQ));
      setInstructions(q.instructions ?? "");
      setPreventMinimize(!!q.preventMinimize);
      setDisableCopyPaste(!!q.disableCopyPaste);
      setResetOnMinimize(!!q.resetOnMinimize);
      setShowResults(q.showResultsImmediately ?? true);
      setDuration(q.timeLimitMin ? String(q.timeLimitMin) : "");
      setMaxAttempts(String(q.maxAttempts ?? 1));
    } catch {
      toast("Could not load quiz", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-muted-foreground">Loading quiz…</p>;
  if (!quiz) return <p className="text-muted-foreground">Quiz not found.</p>;

  const isDraft = quiz.status === "DRAFT";
  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);

  const patch = (key: string, next: Partial<BQ>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...next } : q)));

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/quiz-take/${quiz!.code}`);
    toast("Quiz link copied", "success");
  }

  async function save(thenPublish = false) {
    // basic validation
    for (const q of questions) {
      if (!q.question.trim()) return toast("Every question needs text", "error");
      if (q.questionType === "MCQ") {
        const opts = q.options.filter((o) => o.trim());
        if (opts.length < 2) return toast("MCQ needs 2+ options", "error");
        if (!opts.includes(q.correctAnswer)) return toast("Mark the correct option for each MCQ", "error");
      }
      if (q.questionType === "DIRECT" && !q.correctAnswer.trim())
        return toast("Direct questions need a model answer", "error");
      if (q.questionType === "MATCH" && q.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2)
        return toast("Match needs 2+ complete pairs", "error");
      if (q.questionType === "FILL_BLANK" && q.blanks.filter((b) => b.trim()).length < 1)
        return toast("Fill-blank needs at least one answer", "error");
    }
    if (questions.length === 0) return toast("Add at least one question", "error");

    setSaving(true);
    try {
      await apiUpdateQuizBuilder(quiz!.id, {
        instructions: instructions.trim() || null,
        preventMinimize,
        disableCopyPaste,
        resetOnMinimize,
        showResultsImmediately: showResults,
        timeLimitMin: duration ? Number(duration) : null,
        maxAttempts: Number(maxAttempts) || 1,
        questions: toPayload(questions),
      });
      if (thenPublish) {
        await apiPublishQuiz(quiz!.id);
        toast("Quiz published", "success");
      } else {
        toast("Quiz saved", "success");
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
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
          <Link href={`/quiz-take/${quiz.code}`} target="_blank"><Button variant="outline" className="h-9"><Play className="mr-2 h-4 w-4" />Preview</Button></Link>
          <Link href={`/quiz/${quiz.id}/results`}><Button variant="outline" className="h-9">Results</Button></Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Status" value={<QuizStatusBadge status={quiz.status} />} />
        <Stat label="Class / Section" value={`${quiz.class?.name ?? ""} — ${quiz.section?.name ?? "All"}`} />
        <Stat label="Subject" value={quiz.subject?.name ?? "—"} />
        <Stat label="Total Marks" value={String(totalMarks)} />
      </div>

      {!isDraft && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          This quiz is {quiz.status.toLowerCase()} and can no longer be edited.
        </p>
      )}

      {/* ── Settings ── */}
      <fieldset disabled={!isDraft} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm disabled:opacity-70">
        <h2 className="font-semibold">Instructions &amp; Rules</h2>
        <div className="space-y-2">
          <Label>Instructions for students (shown before they start)</Label>
          <Textarea value={instructions} onChange={(e) => setInstructions(e.target.value)} rows={3} placeholder="e.g. Read each question carefully. You have one attempt." />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Time limit (minutes, blank = none)</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Max attempts</Label>
            <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
          </div>
        </div>
        <div className="space-y-2">
          <Toggle label="Show result to student immediately after finishing" checked={showResults} onChange={setShowResults} />
          <Toggle label="Prevent minimizing / leaving the exam tab" checked={preventMinimize} onChange={setPreventMinimize} />
          <Toggle label="Reset all answers if the student leaves the tab" checked={resetOnMinimize} onChange={setResetOnMinimize} />
          <Toggle label="Disable copy &amp; paste" checked={disableCopyPaste} onChange={setDisableCopyPaste} />
        </div>
      </fieldset>

      {/* ── Questions ── */}
      <fieldset disabled={!isDraft} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm disabled:opacity-70">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">Questions ({questions.length})</h2>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionEditor key={q.key} q={q} index={i} onChange={(n) => patch(q.key, n)} onRemove={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))} />
          ))}
          {questions.length === 0 && <p className="text-sm text-muted-foreground">No questions yet — add one below.</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Label className="mb-0">Add:</Label>
          <Select value={addType} onChange={(e) => setAddType(e.target.value as QType)} className="h-9 w-48">
            {(Object.keys(TYPE_LABEL) as QType[]).map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </Select>
          <Button variant="outline" className="h-9" onClick={() => setQuestions((qs) => [...qs, blankQuestion(addType)])}>
            <Plus className="mr-2 h-4 w-4" />Add question
          </Button>
        </div>
      </fieldset>

      {isDraft && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-10" disabled={saving} onClick={() => void save(false)}>
            <Save className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Save draft"}
          </Button>
          <Button className="h-10" disabled={saving} onClick={() => void save(true)}>
            {saving ? "Publishing…" : "Save & Publish"}
          </Button>
        </div>
      )}
    </div>
  );
}

function QuestionEditor({ q, index, onChange, onRemove }: { q: BQ; index: number; onChange: (n: Partial<BQ>) => void; onRemove: () => void }) {
  return (
    <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Q{index + 1} · {TYPE_LABEL[q.questionType]}
        </span>
        <div className="flex items-center gap-2">
          <Input type="number" value={q.marks} onChange={(e) => onChange({ marks: Number(e.target.value) || 1 })} className="h-8 w-16" title="Marks" />
          <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <Textarea value={q.question} onChange={(e) => onChange({ question: e.target.value })} rows={2} placeholder={q.questionType === "FILL_BLANK" ? "Use ___ for each blank, e.g. The capital of France is ___" : "Question text"} />

      {q.questionType === "MCQ" && (
        <div className="space-y-2">
          <Label className="text-xs">Options (pick the correct one)</Label>
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input type="radio" name={`correct-${q.key}`} checked={!!opt && q.correctAnswer === opt} onChange={() => onChange({ correctAnswer: opt })} title="Correct answer" />
              <Input value={opt} onChange={(e) => { const options = [...q.options]; options[oi] = e.target.value; const next: Partial<BQ> = { options }; if (q.correctAnswer === opt) next.correctAnswer = e.target.value; onChange(next); }} className="h-9" placeholder={`Option ${oi + 1}`} />
              {q.options.length > 2 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ options: q.options.filter((_, x) => x !== oi) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ options: [...q.options, ""] })}><Plus className="mr-1 h-3 w-3" />Option</Button>
        </div>
      )}

      {q.questionType === "DIRECT" && (
        <div className="space-y-2">
          <Label className="text-xs">Model answer</Label>
          <Textarea value={q.correctAnswer} onChange={(e) => onChange({ correctAnswer: e.target.value })} rows={2} placeholder="The correct / expected answer" />
          <Label className="text-xs">Grading</Label>
          <Select value={q.gradingMode} onChange={(e) => onChange({ gradingMode: e.target.value as BQ["gradingMode"] })} className="h-9">
            <option value="EXACT">Exact match (answer must match)</option>
            <option value="AI_CONCEPT">AI concept (AI scores how close the answer is)</option>
          </Select>
        </div>
      )}

      {q.questionType === "MATCH" && (
        <div className="space-y-2">
          <Label className="text-xs">Pairs (left ↔ right)</Label>
          {q.pairs.map((p, pi) => (
            <div key={pi} className="flex items-center gap-2">
              <Input value={p.left} onChange={(e) => { const pairs = [...q.pairs]; pairs[pi] = { ...pairs[pi], left: e.target.value }; onChange({ pairs }); }} className="h-9" placeholder="Left" />
              <span className="text-muted-foreground">↔</span>
              <Input value={p.right} onChange={(e) => { const pairs = [...q.pairs]; pairs[pi] = { ...pairs[pi], right: e.target.value }; onChange({ pairs }); }} className="h-9" placeholder="Right" />
              {q.pairs.length > 2 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ pairs: q.pairs.filter((_, x) => x !== pi) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ pairs: [...q.pairs, { left: "", right: "" }] })}><Plus className="mr-1 h-3 w-3" />Pair</Button>
        </div>
      )}

      {q.questionType === "FILL_BLANK" && (
        <div className="space-y-2">
          <Label className="text-xs">Answer for each blank (in order)</Label>
          {q.blanks.map((b, bi) => (
            <div key={bi} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{bi + 1}</span>
              <Input value={b} onChange={(e) => { const blanks = [...q.blanks]; blanks[bi] = e.target.value; onChange({ blanks }); }} className="h-9" placeholder={`Blank ${bi + 1} answer`} />
              {q.blanks.length > 1 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ blanks: q.blanks.filter((_, x) => x !== bi) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ blanks: [...q.blanks, ""] })}><Plus className="mr-1 h-3 w-3" />Blank</Button>
        </div>
      )}
    </div>
  );
}

function Toggle({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="flex items-center gap-2 text-sm">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4" />
      <span dangerouslySetInnerHTML={{ __html: label }} />
    </label>
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
