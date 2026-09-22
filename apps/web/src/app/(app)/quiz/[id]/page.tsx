"use client";


import { useT } from "@/lib/i18n/provider";
import { use, useCallback, useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { ArrowLeft, Copy, FlaskConical, Play, Plus, Save, Trash2, X } from "lucide-react";
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
import { cn } from "@/lib/utils";
import { QuizVersionHistory } from "@/components/quiz/version-history";
import {
  QuizEditModeDialog,
  type QuizEditMode,
} from "@/components/quiz/edit-mode-dialog";
import { useAuth } from "@/lib/auth";
import { quizFieldProps } from "@/components/quiz/rtl-text";
import { RichTextEditor } from "@/components/quiz/rich-text";
import {
  ARABIC_FONTS,
  QUIZ_LANGUAGES,
  quizDirectionSetting,
  resolveDirection,
  TF_DEFAULT_ACCEPTED,
  tfConflicts,
  tfLabels,
  type DirectionSetting,
  type TfValue,
} from "@ekulmis/shared";

type QType =
  | "MCQ"
  | "DIRECT"
  | "MATCH"
  | "FILL_BLANK"
  | "TRUE_FALSE"
  | "TRUE_FALSE_WRITTEN";

const QTYPES: QType[] = [
  "MCQ",
  "TRUE_FALSE",
  "TRUE_FALSE_WRITTEN",
  "DIRECT",
  "MATCH",
  "FILL_BLANK",
];

interface BQ {
  key: string;
  /**
   * The question row this already is on the server, when it is one.
   *
   * Carried through the editor and sent back on save so the server updates it
   * in place. Without it every save was a delete-and-recreate, and the answers
   * students had already given pointed at questions that no longer existed.
   */
  id?: string;
  question: string;
  questionType: QType;
  options: string[];
  correctAnswer: string;
  gradingMode: "EXACT" | "AI_CONCEPT";
  pairs: { left: string; right: string }[];
  blanks: string[];
  marks: number;
  /**
   * Which way this one question runs, when it differs from the paper's.
   *
   * Null means "as the quiz says", which is what almost every question wants.
   * The exception is a genuinely mixed paper — question 1 in English,
   * question 2 in Arabic — which schools here do set.
   */
  direction: DirectionSetting | null;
  contentFont: string | null;
  /**
   * The question as the teacher formatted it, or null when it is plain.
   *
   * `question` holds the same words without the formatting. Both are sent:
   * the screen shows the formatted one, and everything else — grading, the
   * change history, an export, a message home — reads the words.
   */
  questionHtml: string | null;
  /** The formatted options, index-aligned with `options`. */
  optionsHtml: string[] | null;
  /**
   * TRUE_FALSE_WRITTEN: the school's own extra words, per side.
   *
   * On top of true / صح / run and false / خطأ / been, which always count and
   * are shown to the teacher but cannot be removed.
   */
  acceptedAnswers: { TRUE: string[]; FALSE: string[] };
}

const TYPE_LABEL: Record<QType, string> = {
  MCQ: "Multiple Choice",
  DIRECT: "Direct Question",
  MATCH: "Match Pairs",
  FILL_BLANK: "Fill in the Blank",
  TRUE_FALSE: "True / False",
  TRUE_FALSE_WRITTEN: "True / False — Written",
};

const isTf = (t: QType) => t === "TRUE_FALSE" || t === "TRUE_FALSE_WRITTEN";

let seq = 0;
const uid = () => `q_${Date.now()}_${seq++}`;

function blankQuestion(type: QType): BQ {
  return {
    key: uid(),
    question: "",
    questionType: type,
    options: type === "MCQ" ? ["", ""] : [],
    // True / False always has an answer chosen, so a new question cannot be
    // saved with none.
    correctAnswer: isTf(type) ? "TRUE" : "",
    gradingMode: "EXACT",
    pairs: type === "MATCH" ? [{ left: "", right: "" }, { left: "", right: "" }] : [],
    blanks: type === "FILL_BLANK" ? [""] : [],
    marks: 1,
    direction: null,
    contentFont: null,
    questionHtml: null,
    optionsHtml: null,
    acceptedAnswers: { TRUE: [], FALSE: [] },
  };
}

function toBQ(q: {
  id?: string;
  question: string;
  questionType?: string;
  options: unknown;
  correctAnswer?: string;
  gradingMode?: "EXACT" | "AI_CONCEPT";
  pairs?: { left: string; right: string }[] | null;
  blanks?: string[] | null;
  marks: number;
  direction?: DirectionSetting | null;
  contentFont?: string | null;
  questionHtml?: string | null;
  optionsHtml?: string[] | null;
  acceptedAnswers?: { TRUE?: string[]; FALSE?: string[] } | null;
}): BQ {
  const type = (q.questionType as QType) ?? "MCQ";
  return {
    key: uid(),
    id: q.id,
    question: q.question,
    questionType: QTYPES.includes(type) ? type : "DIRECT",
    options: Array.isArray(q.options) ? (q.options as string[]) : [],
    correctAnswer: q.correctAnswer ?? "",
    gradingMode: q.gradingMode ?? "EXACT",
    pairs: q.pairs ?? [],
    blanks: q.blanks ?? [],
    marks: q.marks,
    direction: q.direction ?? null,
    contentFont: q.contentFont ?? null,
    questionHtml: q.questionHtml ?? null,
    optionsHtml: Array.isArray(q.optionsHtml) ? q.optionsHtml : null,
    acceptedAnswers: {
      TRUE: q.acceptedAnswers?.TRUE ?? [],
      FALSE: q.acceptedAnswers?.FALSE ?? [],
    },
  };
}

function toPayload(qs: BQ[]): QuizBuilderQuestion[] {
  return qs.map((q) => ({
    // Only for a question that already exists; a new one has none and the
    // server creates it.
    ...(q.id ? { id: q.id } : {}),
    question: q.question.trim(),
    questionType: q.questionType,
    options: q.questionType === "MCQ" ? q.options.filter((o) => o.trim()) : [],
    correctAnswer: q.correctAnswer,
    gradingMode: q.gradingMode,
    pairs: q.questionType === "MATCH" ? q.pairs.filter((p) => p.left.trim() && p.right.trim()) : [],
    blanks: q.questionType === "FILL_BLANK" ? q.blanks.filter((b) => b.trim()) : [],
    marks: q.marks,
    direction: q.direction,
    contentFont: q.contentFont,
    questionHtml: q.questionHtml,
    // Only the options that survived the trim above keep their formatting,
    // and in the same order, or a highlight lands on the wrong choice.
    optionsHtml:
      q.questionType === "MCQ" && q.optionsHtml
        ? q.options
            .map((o, i) => [o, q.optionsHtml?.[i] ?? ""] as const)
            .filter(([o]) => o.trim())
            .map(([, h]) => h)
        : null,
    acceptedAnswers:
      q.questionType === "TRUE_FALSE_WRITTEN"
        ? {
            TRUE: q.acceptedAnswers.TRUE.map((w) => w.trim()).filter(Boolean),
            FALSE: q.acceptedAnswers.FALSE.map((w) => w.trim()).filter(Boolean),
          }
        : null,
  }));
}

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
      if (isTf(q.questionType) && q.correctAnswer !== "TRUE" && q.correctAnswer !== "FALSE")
        return toast(tr("quizTf.chooseAnswer"), "error");
      if (q.questionType === "TRUE_FALSE_WRITTEN") {
        // Caught here, by the teacher who made it, rather than on a student's
        // result: a word on both sides marks every answer using it right.
        const clash = tfConflicts(q.acceptedAnswers);
        if (clash.length)
          return toast(`${tr("quizTf.bothSides")} ${clash.join(", ")}`, "error");
      }
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

function QuestionEditor({
  q,
  index,
  quizDirection,
  quizFont,
  language,
  onChange,
  onRemove,
}: {
  q: BQ;
  index: number;
  quizDirection: DirectionSetting;
  quizFont: string | null;
  language: string;
  onChange: (n: Partial<BQ>) => void;
  onRemove: () => void;
}) {
  const tr = useT();
  // Every field a teacher types content into turns round with the question,
  // because an input that stays left-to-right while Arabic is typed into it
  // puts the cursor on the wrong side and the question mark at the wrong end.
  const fld = (text: string) =>
    quizFieldProps(text || q.question, q.direction, quizDirection, q.contentFont, quizFont);
  return (
    <div className="space-y-3 rounded-lg border bg-secondary/20 p-4">
      <div className="flex items-center justify-between">
        <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
          Q{index + 1} · {TYPE_LABEL[q.questionType]}
        </span>
        <div className="flex items-center gap-2">
          <Select
            value={q.direction ?? ""}
            onChange={(e) =>
              onChange({ direction: (e.target.value || null) as DirectionSetting | null })
            }
            className="h-8 w-28 text-xs"
            title={tr("quiz.questionDirection")}
          >
            <option value="">{tr("quiz.dirAsQuiz")}</option>
            <option value="LTR">{tr("quiz.dirLtr")}</option>
            <option value="RTL">{tr("quiz.dirRtl")}</option>
          </Select>
          <Input type="number" value={q.marks} onChange={(e) => onChange({ marks: Number(e.target.value) || 1 })} className="h-8 w-16" title={tr("quiz.marks")} />
          <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>
        </div>
      </div>

      <RichTextEditor
        text={q.question}
        html={q.questionHtml}
        rows={2}
        direction={q.direction}
        quizDirection={quizDirection}
        font={q.contentFont}
        quizFont={quizFont}
        placeholder={q.questionType === "FILL_BLANK" ? "Use ___ for each blank, e.g. The capital of France is ___" : "Question text"}
        onChange={(n) => onChange({ question: n.text, questionHtml: n.html })}
      />
      <p className="text-[11px] text-muted-foreground">{tr("richText.hint")}</p>

      {q.questionType === "MCQ" && (
        <div className="space-y-2">
          <Label className="text-xs">{tr("quiz.optionsPickTheCorrectOne")}</Label>
          {q.options.map((opt, oi) => (
            <div key={oi} className="flex items-center gap-2">
              <input type="radio" name={`correct-${q.key}`} checked={!!opt && q.correctAnswer === opt} onChange={() => onChange({ correctAnswer: opt })} title={tr("quiz.correctAnswer")} />
              <div className="flex-1">
                <RichTextEditor
                  compact
                  rows={1}
                  text={opt}
                  html={q.optionsHtml?.[oi] ?? null}
                  direction={q.direction}
                  quizDirection={quizDirection}
                  font={q.contentFont}
                  quizFont={quizFont}
                  placeholder={`Option ${oi + 1}`}
                  onChange={(n) => {
                    const options = [...q.options];
                    options[oi] = n.text;
                    const optionsHtml = [...(q.optionsHtml ?? q.options.map(() => ""))];
                    optionsHtml[oi] = n.html ?? "";
                    const next: Partial<BQ> = {
                      options,
                      optionsHtml: optionsHtml.some((h) => h) ? optionsHtml : null,
                    };
                    // The right answer is stored as the option's words, so it
                    // has to move with them or the paper marks itself wrong.
                    if (q.correctAnswer === opt) next.correctAnswer = n.text;
                    onChange(next);
                  }}
                />
              </div>
              {q.options.length > 2 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ options: q.options.filter((_, x) => x !== oi), optionsHtml: q.optionsHtml ? q.optionsHtml.filter((_, x) => x !== oi) : null })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ options: [...q.options, ""], optionsHtml: q.optionsHtml ? [...q.optionsHtml, ""] : null })}><Plus className="me-1 h-3 w-3" />{tr("quiz.option")}</Button>
        </div>
      )}

      {q.questionType === "DIRECT" && (
        <div className="space-y-2">
          <Label className="text-xs">{tr("quiz.modelAnswer")}</Label>
          <Textarea {...fld(q.correctAnswer)} value={q.correctAnswer} onChange={(e) => onChange({ correctAnswer: e.target.value })} rows={2} placeholder={tr("quiz.theCorrectExpectedAnswer")} />
          <Label className="text-xs">{tr("quiz.grading")}</Label>
          <Select value={q.gradingMode} onChange={(e) => onChange({ gradingMode: e.target.value as BQ["gradingMode"] })} className="h-9">
            <option value="EXACT">{tr("quiz.exactMatchAnswerMustMatch")}</option>
            <option value="AI_CONCEPT">{tr("quiz.aiConceptAiScoresHowClose")}</option>
          </Select>
        </div>
      )}

      {q.questionType === "MATCH" && (
        <div className="space-y-2">
          <Label className="text-xs">{tr("quiz.pairsLeftRight")}</Label>
          {q.pairs.map((p, pi) => (
            <div key={pi} className="flex items-center gap-2">
              <Input {...fld(p.left)} value={p.left} onChange={(e) => { const pairs = [...q.pairs]; pairs[pi] = { ...pairs[pi], left: e.target.value }; onChange({ pairs }); }} className="h-9" placeholder={tr("quiz.left")} />
              <span className="text-muted-foreground">↔</span>
              <Input {...fld(p.right)} value={p.right} onChange={(e) => { const pairs = [...q.pairs]; pairs[pi] = { ...pairs[pi], right: e.target.value }; onChange({ pairs }); }} className="h-9" placeholder={tr("quiz.right")} />
              {q.pairs.length > 2 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ pairs: q.pairs.filter((_, x) => x !== pi) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ pairs: [...q.pairs, { left: "", right: "" }] })}><Plus className="me-1 h-3 w-3" />{tr("quiz.pair")}</Button>
        </div>
      )}

      {isTf(q.questionType) && (
        <TrueFalseEditor
          q={q}
          labels={tfLabels(
            language,
            resolveDirection(q.direction ?? quizDirection, q.question),
          )}
          onChange={onChange}
        />
      )}

      {q.questionType === "FILL_BLANK" && (
        <div className="space-y-2">
          <Label className="text-xs">{tr("quiz.answerForEachBlankInOrder")}</Label>
          {q.blanks.map((b, bi) => (
            <div key={bi} className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">#{bi + 1}</span>
              <Input {...fld(b)} value={b} onChange={(e) => { const blanks = [...q.blanks]; blanks[bi] = e.target.value; onChange({ blanks }); }} className="h-9" placeholder={`Blank ${bi + 1} answer`} />
              {q.blanks.length > 1 && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onChange({ blanks: q.blanks.filter((_, x) => x !== bi) })}><Trash2 className="h-4 w-4" /></Button>}
            </div>
          ))}
          <Button variant="outline" className="h-8" onClick={() => onChange({ blanks: [...q.blanks, ""] })}><Plus className="me-1 h-3 w-3" />{tr("quiz.blank")}</Button>
        </div>
      )}
    </div>
  );
}

/**
 * The answer to a True / False question, and for the written kind, what else
 * counts as having written it.
 *
 * No options to type: the teacher picks TRUE or FALSE, shown in the paper's
 * own words. For the written kind the built-in words are listed so the teacher
 * can see what already counts, and the school adds its own — "sax", "T" — per
 * side. Whether an abbreviation is good enough is the school's call.
 */
function TrueFalseEditor({
  q,
  labels,
  onChange,
}: {
  q: BQ;
  labels: Record<TfValue, string>;
  onChange: (n: Partial<BQ>) => void;
}) {
  const tr = useT();
  const [draft, setDraft] = useState<Record<TfValue, string>>({ TRUE: "", FALSE: "" });
  const written = q.questionType === "TRUE_FALSE_WRITTEN";

  const add = (side: TfValue) => {
    const w = draft[side].trim();
    if (!w) return;
    if (q.acceptedAnswers[side].some((x) => x.toLowerCase() === w.toLowerCase())) return;
    onChange({
      acceptedAnswers: { ...q.acceptedAnswers, [side]: [...q.acceptedAnswers[side], w] },
    });
    setDraft((d) => ({ ...d, [side]: "" }));
  };
  const remove = (side: TfValue, i: number) =>
    onChange({
      acceptedAnswers: {
        ...q.acceptedAnswers,
        [side]: q.acceptedAnswers[side].filter((_, x) => x !== i),
      },
    });

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label className="text-xs">{tr("quizTf.correctAnswer")}</Label>
        <div className="flex flex-wrap gap-2">
          {(["TRUE", "FALSE"] as TfValue[]).map((v) => (
            <label
              key={v}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-lg border px-4 py-2 text-sm",
                q.correctAnswer === v && "border-primary bg-primary/10 font-medium",
              )}
            >
              <input
                type="radio"
                name={`tf-${q.key}`}
                checked={q.correctAnswer === v}
                onChange={() => onChange({ correctAnswer: v })}
              />
              {v === "TRUE" ? "TRUE" : "FALSE"}
              {labels[v] !== (v === "TRUE" ? "True" : "False") && (
                <span className="text-muted-foreground" dir="auto">
                  ({labels[v]})
                </span>
              )}
            </label>
          ))}
        </div>
      </div>

      {written && (
        <div className="grid gap-3 sm:grid-cols-2">
          {(["TRUE", "FALSE"] as TfValue[]).map((side) => (
            <div key={side} className="space-y-2 rounded-lg border bg-background p-3">
              <p className="text-xs font-medium">
                {tr("quizTf.acceptedFor")} {side}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {TF_DEFAULT_ACCEPTED[side].map((w) => (
                  <span
                    key={w}
                    dir="auto"
                    title={tr("quizTf.alwaysAccepted")}
                    className="rounded-full bg-secondary px-2 py-0.5 text-xs text-muted-foreground"
                  >
                    {w}
                  </span>
                ))}
                {q.acceptedAnswers[side].map((w, i) => (
                  <span
                    key={`${w}-${i}`}
                    dir="auto"
                    className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary"
                  >
                    {w}
                    <button
                      type="button"
                      onClick={() => remove(side, i)}
                      aria-label={tr("quizTf.remove")}
                      className="rounded-full hover:bg-primary/20"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
              <div className="flex gap-1.5">
                <Input
                  dir="auto"
                  value={draft[side]}
                  onChange={(e) => setDraft((d) => ({ ...d, [side]: e.target.value }))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      add(side);
                    }
                  }}
                  className="h-8 text-xs"
                  placeholder={side === "TRUE" ? "sax, T…" : "khalad, F…"}
                />
                <Button variant="outline" className="h-8 px-2" onClick={() => add(side)}>
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
          <p className="text-[11px] text-muted-foreground sm:col-span-2">
            {tr("quizTf.acceptedHint")}
          </p>
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
