"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, FlaskConical, Library, Play, Plus, Save } from "lucide-react";
import { BankPickerDialog, SaveToBankDialog } from "@/components/quiz/bank-quiz-dialogs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { QuizStatusBadge } from "@/components/quiz/status-badge";
import {
  apiGetQuiz,
  apiPublishQuiz,
  apiUpdateQuizBuilder,
  type ApiQuiz,
} from "@/lib/quiz/api";
import { toast } from "@/lib/toast";
import { QuizVersionHistory } from "@/components/quiz/version-history";
import {
  QuizEditModeDialog,
  type QuizEditMode,
} from "@/components/quiz/edit-mode-dialog";
import { useAuth } from "@/lib/auth";
import { RichTextEditor } from "@/components/quiz/rich-text";
import {
  blankQuestion,
  QTYPES,
  QuestionEditor,
  questionProblem,
  toBQ,
  toPayload,
  TYPE_LABEL,
  type BQ,
  type QType,
} from "@/components/quiz/question-editor";
import {
  ARABIC_FONTS,
  QUIZ_LANGUAGES,
  quizDirectionSetting,
  type DirectionSetting,
} from "@ekulmis/shared";

export default function QuizBuilderPage({ params }: { params: Promise<{ id: string }> }) {
  const tr = useT();
  const { id } = use(params);
  const { user } = useAuth();
  const isTeacher = user?.role === "TEACHER";
  const listHref = isTeacher ? "/teacher-portal/quizzes" : "/quiz/list";
  const quizBase = isTeacher ? "/teacher-portal/quizzes" : "/quiz";
  const [quiz, setQuiz] = useState<ApiQuiz | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [askEditMode, setAskEditMode] = useState(false);
  const [pendingPublish, setPendingPublish] = useState(false);
  const [questions, setQuestions] = useState<BQ[]>([]);
  const [instructions, setInstructions] = useState("");
  const [instructionsHtml, setInstructionsHtml] = useState<string | null>(null);
  const [preventMinimize, setPreventMinimize] = useState(false);
  const [disableCopyPaste, setDisableCopyPaste] = useState(false);
  const [resetOnMinimize, setResetOnMinimize] = useState(false);
  const [showResults, setShowResults] = useState(true);
  const [allowReview, setAllowReview] = useState(true);
  const [allowPdf, setAllowPdf] = useState(true);
  const [duration, setDuration] = useState("");
  const [maxAttempts, setMaxAttempts] = useState("1");
  const [passing, setPassing] = useState("");
  const [language, setLanguage] = useState("AUTO");
  const [direction, setDirection] = useState<DirectionSetting>("AUTO");
  const [contentFont, setContentFont] = useState("");
  /** JSON of the questions as loaded, to tell a real edit from a plain save. */
  const [questionsAtLoad, setQuestionsAtLoad] = useState("");
  const [addType, setAddType] = useState<QType>("MCQ");
  const [pickFromBank, setPickFromBank] = useState(false);
  const [saveToBank, setSaveToBank] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = await apiGetQuiz(id);
      setQuiz(q);
      const loaded = (q.questions ?? []).map(toBQ);
      setQuestions(loaded);
      setQuestionsAtLoad(JSON.stringify(toPayload(loaded)));
      setInstructions(q.instructions ?? "");
      setInstructionsHtml(q.instructionsHtml ?? null);
      setPreventMinimize(!!q.preventMinimize);
      setDisableCopyPaste(!!q.disableCopyPaste);
      setResetOnMinimize(!!q.resetOnMinimize);
      setShowResults(q.showResultsImmediately ?? true);
      setAllowReview(q.allowReviewAnswers ?? true);
      setAllowPdf(q.allowPdfDownload ?? true);
      setDuration(q.timeLimitMin ? String(q.timeLimitMin) : "");
      setMaxAttempts(String(q.maxAttempts ?? 1));
      setPassing(q.passingMarks != null ? String(q.passingMarks) : "");
      setLanguage(q.language ?? "AUTO");
      setDirection((q.direction as DirectionSetting) ?? "AUTO");
      setContentFont(q.contentFont ?? "");
    } catch {
      toast("Could not load quiz", "error");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <p className="text-muted-foreground">{tr("quiz.loadingQuiz")}</p>;
  if (!quiz) return <p className="text-muted-foreground">{tr("quiz.quizNotFound")}</p>;

  const isDraft = quiz.status === "DRAFT";
  // A published quiz was frozen whole, which meant a pass mark set too high —
  // or a typo in the instructions — could never be corrected. None of that
  // touches what a student answered. The questions are the exception: once
  // somebody has answered them, rewriting them changes what their marks were
  // awarded against, so those stay locked.
  const attemptCount = quiz._count?.attempts ?? 0;
  const canEdit = quiz.status !== "ARCHIVED";
  // Schools have to be able to fix their own paper — a wrong correct answer, a
  // typo — whenever they spot it. Rewriting questions after students have
  // answered costs them the ability to review those sheets against the paper,
  // so it is confirmed rather than refused.
  const canEditQuestions = canEdit;
  const questionsDirty =
    questionsAtLoad !== "" && JSON.stringify(toPayload(questions)) !== questionsAtLoad;
  const totalMarks = questions.reduce((s, q) => s + (Number(q.marks) || 0), 0);
  // An Arabic paper left on Auto is right-to-left: saying the language is
  // Arabic is saying enough, and a paper of diagrams and numbers has nothing
  // for detection to work from.
  const quizDir = quizDirectionSetting(language, direction);

  const patch = (key: string, next: Partial<BQ>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...next } : q)));

  function copyLink() {
    navigator.clipboard.writeText(`${window.location.origin}/quiz-take/${quiz!.code}`);
    toast("Quiz link copied", "success");
  }

  async function save(
    thenPublish = false,
    edit?: { mode: QuizEditMode; reason: string },
  ) {
    // A paper students have already sat is an academic record. Which kind of
    // change this is decides what those students are shown afterwards, so it
    // is asked once, here, before anything is written — and the answer is
    // carried into the save rather than guessed at by the server.
    if (attemptCount > 0 && questionsDirty && !edit) {
      setAskEditMode(true);
      setPendingPublish(thenPublish);
      return;
    }
    // basic validation — the same rules the question bank uses
    for (const q of questions) {
      const problem = questionProblem(q, tr);
      if (problem) return toast(problem, "error");
    }
    if (canEditQuestions && questions.length === 0)
      return toast("Add at least one question", "error");

    setSaving(true);
    try {
      await apiUpdateQuizBuilder(quiz!.id, {
        instructions: instructions.trim() || null,
        instructionsHtml,
        preventMinimize,
        disableCopyPaste,
        resetOnMinimize,
        showResultsImmediately: showResults,
        allowReviewAnswers: allowReview,
        allowPdfDownload: allowPdf,
        timeLimitMin: duration ? Number(duration) : null,
        maxAttempts: Number(maxAttempts) || 1,
        passingMarks: passing.trim() === "" ? null : Number(passing),
        language,
        direction,
        contentFont: contentFont || null,
        ...(canEditQuestions ? { questions: toPayload(questions) } : {}),
        ...(edit
          ? { editMode: edit.mode, ...(edit.reason ? { editReason: edit.reason } : {}) }
          : {}),
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
          <Link href={listHref} className="inline-flex items-center gap-2 text-sm text-primary">
            <ArrowLeft className="h-4 w-4" />{tr("quiz.allQuizzes")}
          </Link>
          <h1 className="mt-2 text-2xl font-bold">{quiz.title}</h1>
          <p className="mt-1 flex flex-wrap items-center gap-2 font-mono text-sm text-muted-foreground">
            {quiz.code}
            {/* Only once it is published: a draft's version says nothing. */}
            {quiz.status !== "DRAFT" && (
              <span className="rounded bg-secondary px-1.5 py-0.5 text-xs font-sans font-medium text-foreground/80">
                v{quiz.version ?? "1.0"}
              </span>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="h-9" onClick={copyLink}><Copy className="me-2 h-4 w-4" />{tr("quiz.copyLink")}</Button>
          <Link href={`/quiz-take/${quiz.code}`} target="_blank"><Button variant="outline" className="h-9"><Play className="me-2 h-4 w-4" />{tr("quiz.preview")}</Button></Link>
          {/* Take the quiz as a student would, without a Student ID. Saved
              changes only: an unsaved edit is not what a student would get. */}
          <Link
            href={`${quizBase}/${quiz.id}/practice`}
            onClick={(e) => {
              if (questionsDirty) {
                e.preventDefault();
                toast(tr("quizPractice.saveFirst"), "error");
              }
            }}
          >
            <Button className="h-9 bg-violet-600 text-white hover:bg-violet-700">
              <FlaskConical className="me-2 h-4 w-4" />
              {tr("quizPractice.tryQuiz")}
            </Button>
          </Link>
          <Link href={`${quizBase}/${quiz.id}/results`}><Button variant="outline" className="h-9">{tr("quiz.results")}</Button></Link>
          {!isDraft && (
            <Link href={`${quizBase}/${quiz.id}/live`}><Button variant="outline" className="h-9">{tr("quiz.liveMonitor")}</Button></Link>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label={tr("quiz.status")} value={<QuizStatusBadge status={quiz.status} />} />
        <Stat label={tr("quiz.classSection")} value={`${quiz.class?.name ?? ""} — ${quiz.section?.name ?? "All"}`} />
        <Stat label={tr("quiz.subject")} value={quiz.subject?.name ?? "—"} />
        <Stat label={tr("quiz.totalMarks")} value={String(totalMarks)} />
      </div>

      {!isDraft && (
        <p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          {!canEdit
            ? tr("quiz.archivedCannotEdit")
            : attemptCount === 0
              ? tr("quiz.publishedCanStillEdit")
              : `${attemptCount} ${tr("quiz.answeredEditWarning")}`}
        </p>
      )}

      {/* ── Settings ── */}
      <fieldset disabled={!canEdit} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm disabled:opacity-70">
        <h2 className="font-semibold">{tr("quiz.instructionsAmpRules")}</h2>
        <div className="space-y-2">
          <Label>{tr("quiz.instructionsForStudentsShownBeforeThey")}</Label>
          <RichTextEditor
            text={instructions}
            html={instructionsHtml}
            rows={3}
            quizDirection={quizDir}
            quizFont={contentFont || null}
            placeholder={tr("quiz.eGReadEachQuestionCarefully")}
            onChange={(n) => {
              setInstructions(n.text);
              setInstructionsHtml(n.html);
            }}
          />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>{tr("quiz.timeLimitMinutesBlankNone")}</Label>
            <Input type="number" value={duration} onChange={(e) => setDuration(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tr("quiz.maxAttempts")}</Label>
            <Input type="number" value={maxAttempts} onChange={(e) => setMaxAttempts(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>{tr("quiz.passMark")}</Label>
            <Input
              type="number"
              min={1}
              max={totalMarks || undefined}
              value={passing}
              placeholder={tr("quiz.passMarkPlaceholder")}
              onChange={(e) => setPassing(e.target.value)}
            />
            <p className="text-xs text-muted-foreground">
              {tr("quiz.passMarkHint")} {totalMarks}.
            </p>
          </div>
        </div>
        {/* Language and direction. A paper written in Arabic has to read as
            Arabic everywhere it appears — here, on the student's screen and on
            the result sheet — and the teacher should not have to set that
            three times, or indeed at all when the text already says so. */}
        <div className="grid gap-3 border-t pt-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>{tr("quiz.language")}</Label>
            <Select value={language} onChange={(e) => setLanguage(e.target.value)} className="h-9">
              {QUIZ_LANGUAGES.map((l) => (
                <option key={l.id} value={l.id}>
                  {tr(`quiz.language_${l.id}`)}
                </option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr("quiz.textDirection")}</Label>
            <Select
              value={direction}
              onChange={(e) => setDirection(e.target.value as DirectionSetting)}
              className="h-9"
            >
              <option value="AUTO">{tr("quiz.dirAuto")}</option>
              <option value="LTR">{tr("quiz.dirLtr")}</option>
              <option value="RTL">{tr("quiz.dirRtl")}</option>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>{tr("quiz.arabicFont")}</Label>
            <Select
              value={contentFont}
              onChange={(e) => setContentFont(e.target.value)}
              className="h-9"
            >
              <option value="">{tr("quiz.fontDefault")}</option>
              {ARABIC_FONTS.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.label}
                </option>
              ))}
            </Select>
          </div>
          <p className="text-xs text-muted-foreground sm:col-span-3">
            {tr("quiz.directionHint")}
          </p>
        </div>

        <div className="space-y-2">
          <Toggle label={tr("quiz.showResultToStudentImmediatelyAfter")} checked={showResults} onChange={setShowResults} />
          <Toggle label={tr("quiz.allowStudentsToReviewAnswersAfter")} checked={allowReview} onChange={setAllowReview} />
          <Toggle label={tr("quiz.allowPdfDownloadOfResultSheet")} checked={allowPdf} onChange={setAllowPdf} />
          <Toggle label={tr("quiz.preventMinimizingLeavingTheExamTab")} checked={preventMinimize} onChange={setPreventMinimize} />
          <Toggle label={tr("quiz.resetAllAnswersIfTheStudent")} checked={resetOnMinimize} onChange={setResetOnMinimize} />
          <Toggle label={tr("quiz.disableCopyAmpPaste")} checked={disableCopyPaste} onChange={setDisableCopyPaste} />
        </div>
      </fieldset>

      {/* ── Questions ── */}
      <fieldset disabled={!canEditQuestions} className="space-y-4 rounded-xl border bg-card p-5 shadow-sm disabled:opacity-70">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">{tr("quiz.questions")}{questions.length})</h2>
        </div>

        <div className="space-y-4">
          {questions.map((q, i) => (
            <QuestionEditor
              key={q.key}
              q={q}
              index={i}
              quizDirection={quizDir}
              quizFont={contentFont || null}
              language={language}
              onChange={(n) => patch(q.key, n)}
              onRemove={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}
            />
          ))}
          {questions.length === 0 && <p className="text-sm text-muted-foreground">{tr("quiz.noQuestionsYetAddOneBelow")}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-2 border-t pt-4">
          <Label className="mb-0">{tr("quiz.add")}</Label>
          <Select value={addType} onChange={(e) => setAddType(e.target.value as QType)} className="h-9 w-48">
            {QTYPES.map((t) => (
              <option key={t} value={t}>{TYPE_LABEL[t]}</option>
            ))}
          </Select>
          <Button variant="outline" className="h-9" onClick={() => setQuestions((qs) => [...qs, blankQuestion(addType)])}>
            <Plus className="me-2 h-4 w-4" />{tr("quiz.addQuestion")}
          </Button>
          <Button variant="outline" className="h-9" onClick={() => setPickFromBank(true)}>
            <Library className="me-2 h-4 w-4" />{tr("questionBank.addFromBank")}
          </Button>
          {questions.some((q) => q.id) && (
            <Button variant="ghost" className="h-9" onClick={() => setSaveToBank(true)}>
              {tr("questionBank.saveToBank")}
            </Button>
          )}
        </div>
      </fieldset>

      {canEdit && (
        <div className="flex flex-wrap justify-end gap-2">
          <Button variant="outline" className="h-10" disabled={saving} onClick={() => void save(false)}>
            <Save className="me-2 h-4 w-4" />
            {saving ? "Saving…" : isDraft ? "Save draft" : "Save changes"}
          </Button>
          {isDraft && (
          <Button className="h-10" disabled={saving} onClick={() => void save(true)}>
            {saving ? "Publishing…" : "Save & Publish"}
          </Button>
          )}
        </div>
      )}
      {/* Only where there is something to account for: a draft nobody has
          sat has no history worth reading. */}
      {quiz.status !== "DRAFT" && <QuizVersionHistory quizId={quiz.id} />}

      <BankPickerDialog
        open={pickFromBank}
        subjectId={quiz.subjectId}
        onClose={() => setPickFromBank(false)}
        onAdd={(copies) => {
          // Copies with no id: saving the quiz makes them its own questions.
          setQuestions((qs) => [...qs, ...copies.map(toBQ)]);
          setPickFromBank(false);
        }}
      />
      <SaveToBankDialog
        open={saveToBank}
        quizId={quiz.id}
        questions={questions}
        onClose={() => setSaveToBank(false)}
      />

      <QuizEditModeDialog
        open={askEditMode}
        attemptCount={attemptCount}
        version={quiz.version ?? "1.0"}
        onCancel={() => setAskEditMode(false)}
        onConfirm={(mode, reason) => {
          setAskEditMode(false);
          void save(pendingPublish, { mode, reason });
        }}
      />
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
