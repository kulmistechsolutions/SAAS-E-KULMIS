"use client";

import { useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { QuizBuilderQuestion } from "@/lib/quiz/api";
import { useT } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";
import { quizFieldProps } from "@/components/quiz/rtl-text";
import { RichTextEditor } from "@/components/quiz/rich-text";
import {
  resolveDirection,
  TF_DEFAULT_ACCEPTED,
  tfConflicts,
  tfLabels,
  type DirectionSetting,
  type TfValue,
} from "@ekulmis/shared";

/*
 * Editing one question — shared by the quiz builder and the question bank.
 *
 * One editor for both, so a question saved to the bank and taken back out
 * into a quiz is edited with exactly the same controls and checked by exactly
 * the same rules. Two copies would drift, and the first difference would be a
 * question the bank accepted and the quiz refused.
 */

export type QType =
  | "MCQ"
  | "DIRECT"
  | "MATCH"
  | "FILL_BLANK"
  | "TRUE_FALSE"
  | "TRUE_FALSE_WRITTEN";

export const QTYPES: QType[] = [
  "MCQ",
  "TRUE_FALSE",
  "TRUE_FALSE_WRITTEN",
  "DIRECT",
  "MATCH",
  "FILL_BLANK",
];

export interface BQ {
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

export const TYPE_LABEL: Record<QType, string> = {
  MCQ: "Multiple Choice",
  DIRECT: "Direct Question",
  MATCH: "Match Pairs",
  FILL_BLANK: "Fill in the Blank",
  TRUE_FALSE: "True / False",
  TRUE_FALSE_WRITTEN: "True / False — Written",
};

export const isTf = (t: QType) => t === "TRUE_FALSE" || t === "TRUE_FALSE_WRITTEN";

let seq = 0;
const uid = () => `q_${Date.now()}_${seq++}`;

export function blankQuestion(type: QType): BQ {
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

export function toBQ(q: {
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

export function toPayload(qs: BQ[]): QuizBuilderQuestion[] {
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

/**
 * What is wrong with a question, in words a teacher can act on — or null.
 *
 * Checked before saving, in the builder and in the bank alike.
 */
export function questionProblem(q: BQ, tr: ReturnType<typeof useT>): string | null {
  if (!q.question.trim()) return "Every question needs text";
  if (q.questionType === "MCQ") {
    const opts = q.options.filter((o) => o.trim());
    if (opts.length < 2) return "MCQ needs 2+ options";
    if (!opts.includes(q.correctAnswer)) return "Mark the correct option for each MCQ";
  }
  if (q.questionType === "DIRECT" && !q.correctAnswer.trim())
    return "Direct questions need a model answer";
  if (q.questionType === "MATCH" && q.pairs.filter((p) => p.left.trim() && p.right.trim()).length < 2)
    return "Match needs 2+ complete pairs";
  if (q.questionType === "FILL_BLANK" && q.blanks.filter((b) => b.trim()).length < 1)
    return "Fill-blank needs at least one answer";
  if (isTf(q.questionType) && q.correctAnswer !== "TRUE" && q.correctAnswer !== "FALSE")
    return tr("quizTf.chooseAnswer");
  if (q.questionType === "TRUE_FALSE_WRITTEN") {
    // Caught here, by the teacher who made it, rather than on a student's
    // result: a word on both sides marks every answer using it right.
    const clash = tfConflicts(q.acceptedAnswers);
    if (clash.length) return `${tr("quizTf.bothSides")} ${clash.join(", ")}`;
  }
  return null;
}

export function QuestionEditor({
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
  /** Absent in the bank, where a question is removed from the list instead. */
  onRemove?: () => void;
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
          {onRemove && <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={onRemove}><Trash2 className="h-4 w-4" /></Button>}
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
