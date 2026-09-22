"use client";

import { useEffect, useState } from "react";
import { quizDirectionSetting } from "@ekulmis/shared";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
import { DIFF_KEY, DIFFICULTIES } from "@/components/quiz/bank-browser";
import {
  apiBankCreate,
  apiBankUpdate,
  type BankItem,
  type BankLanguage,
  type BankMeta,
  type BankOptions,
} from "@/lib/quiz/bank-api";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";

/**
 * Writing or changing one bank question.
 *
 * The question itself is edited with the quiz builder's own editor and
 * checked by the same rules, so what the bank accepts a quiz will accept.
 * Around it, what the bank files the question under: subject, class, year,
 * topic, difficulty, language, and whether colleagues can use it.
 */
export function BankItemDialog({
  open,
  item,
  options,
  onClose,
  onSaved,
}: {
  open: boolean;
  /** The question being changed; absent when writing a new one. */
  item: BankItem | null;
  options: BankOptions | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [type, setType] = useState<QType>("MCQ");
  const [q, setQ] = useState<BQ>(blankQuestion("MCQ"));
  const [meta, setMeta] = useState<BankMeta>({
    difficulty: "MEDIUM",
    language: "AUTO",
    shared: true,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (item) {
      const bq = toBQ({
        ...item,
        options: item.options,
        pairs: item.pairs,
        blanks: item.blanks,
      });
      setType(bq.questionType);
      setQ(bq);
      setMeta({
        subjectId: item.subjectId,
        classId: item.classId,
        academicYearId: item.academicYearId,
        topic: item.topic,
        difficulty: item.difficulty,
        language: item.language,
        shared: item.shared,
      });
    } else {
      const active = options?.academicYears.find((y) => y.isActive);
      setType("MCQ");
      setQ(blankQuestion("MCQ"));
      setMeta({
        difficulty: "MEDIUM",
        language: "AUTO",
        shared: true,
        academicYearId: active?.id ?? null,
      });
    }
  }, [open, item, options]);

  async function save() {
    const problem = questionProblem(q, t);
    if (problem) return toast(problem, "error");
    const [payload] = toPayload([q]);
    // A bank question has no id in any quiz; the payload's id would be the
    // bank row's own, which the server must not read as a quiz question.
    const { id: _ignored, ...question } = payload as typeof payload & { id?: string };
    void _ignored;
    setSaving(true);
    try {
      if (item) await apiBankUpdate(item.id, { question, meta });
      else await apiBankCreate(question, meta);
      toast(t("questionBank.saved"), "success");
      onSaved();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save the question", "error");
    } finally {
      setSaving(false);
    }
  }

  const classes = options?.classes.filter(
    (c) => !meta.academicYearId || c.academicYearId === meta.academicYearId,
  );

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={item ? t("questionBank.editTitle") : t("questionBank.newTitle")}
      className="max-w-3xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? t("questionBank.saving") : t("questionBank.save")}
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] space-y-4 overflow-y-auto pe-1">
        <div className="grid gap-3 sm:grid-cols-3">
          {!item && (
            <div className="space-y-1.5">
              <Label className="text-xs">{t("questionBank.type")}</Label>
              <Select
                value={type}
                onChange={(e) => {
                  const next = e.target.value as QType;
                  setType(next);
                  // A fresh question of the new type, keeping the words typed.
                  setQ((prev) => ({ ...blankQuestion(next), question: prev.question, questionHtml: prev.questionHtml }));
                }}
                className="h-9"
              >
                {QTYPES.map((qt) => (
                  <option key={qt} value={qt}>{TYPE_LABEL[qt]}</option>
                ))}
              </Select>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.subject")}</Label>
            <Select value={meta.subjectId ?? ""} onChange={(e) => setMeta({ ...meta, subjectId: e.target.value || null })} className="h-9">
              <option value="">—</option>
              {options?.subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.year")}</Label>
            <Select value={meta.academicYearId ?? ""} onChange={(e) => setMeta({ ...meta, academicYearId: e.target.value || null, classId: null })} className="h-9">
              <option value="">—</option>
              {options?.academicYears.map((y) => (
                <option key={y.id} value={y.id}>{y.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.class")}</Label>
            <Select value={meta.classId ?? ""} onChange={(e) => setMeta({ ...meta, classId: e.target.value || null })} className="h-9">
              <option value="">—</option>
              {classes?.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.topic")}</Label>
            <Input
              list="bank-topics"
              value={meta.topic ?? ""}
              onChange={(e) => setMeta({ ...meta, topic: e.target.value })}
              placeholder={t("questionBank.topicHint")}
              className="h-9"
              maxLength={80}
            />
            <datalist id="bank-topics">
              {options?.topics.map((tp) => <option key={tp} value={tp} />)}
            </datalist>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.difficulty")}</Label>
            <Select value={meta.difficulty} onChange={(e) => setMeta({ ...meta, difficulty: e.target.value as BankMeta["difficulty"] })} className="h-9">
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{t(DIFF_KEY[d])}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("quiz.language")}</Label>
            <Select value={meta.language} onChange={(e) => setMeta({ ...meta, language: e.target.value as BankLanguage })} className="h-9">
              <option value="AUTO">{t("quiz.language_AUTO")}</option>
              <option value="en">{t("quiz.language_en")}</option>
              <option value="ar">{t("quiz.language_ar")}</option>
              <option value="so">{t("quiz.language_so")}</option>
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end text-sm sm:col-span-2">
            <input
              type="checkbox"
              checked={meta.shared}
              onChange={(e) => setMeta({ ...meta, shared: e.target.checked })}
            />
            {t("questionBank.shareWithColleagues")}
          </label>
        </div>

        <QuestionEditor
          q={q}
          index={0}
          quizDirection={quizDirectionSetting(meta.language, "AUTO")}
          quizFont={null}
          language={meta.language}
          onChange={(n) => setQ((prev) => ({ ...prev, ...n }))}
        />
      </div>
    </Dialog>
  );
}
