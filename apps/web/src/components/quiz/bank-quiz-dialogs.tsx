"use client";

import { useEffect, useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { BankBrowser, DIFF_KEY, DIFFICULTIES } from "@/components/quiz/bank-browser";
import { TYPE_LABEL, type BQ } from "@/components/quiz/question-editor";
import {
  apiBankFromQuiz,
  apiBankOptions,
  apiBankUse,
  type BankItem,
  type BankOptions,
  type QuestionDifficulty,
} from "@/lib/quiz/bank-api";
import type { ApiQuizQuestion } from "@/lib/quiz/api";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";

/** The filters, fetched once per dialog opening. */
function useBankOptions(open: boolean) {
  const [options, setOptions] = useState<BankOptions | null>(null);
  useEffect(() => {
    if (!open || options) return;
    apiBankOptions()
      .then(setOptions)
      .catch(() => setOptions(null));
  }, [open, options]);
  return options;
}

/**
 * Pick questions from the bank into this quiz.
 *
 * They arrive as copies with no id, so saving the quiz creates questions of
 * its own; changing the bank afterwards never reaches into this paper. Opens
 * on the quiz's own subject, because that is almost always where the teacher
 * wants to look first.
 */
export function BankPickerDialog({
  open,
  subjectId,
  onClose,
  onAdd,
}: {
  open: boolean;
  subjectId?: string | null;
  onClose: () => void;
  onAdd: (questions: ApiQuizQuestion[]) => void;
}) {
  const t = useT();
  const options = useBankOptions(open);
  const [picked, setPicked] = useState<Map<string, BankItem>>(new Map());
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    if (open) setPicked(new Map());
  }, [open]);

  async function add() {
    if (picked.size === 0) return;
    setAdding(true);
    try {
      const copies = await apiBankUse([...picked.keys()]);
      onAdd(copies);
      toast(t("questionBank.addedToQuiz").replace("{n}", String(copies.length)), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not add the questions", "error");
    } finally {
      setAdding(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("questionBank.pickTitle")}
      className="max-w-4xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void add()} disabled={picked.size === 0 || adding}>
            {t("questionBank.addN").replace("{n}", String(picked.size))}
          </Button>
        </>
      }
    >
      <div className="max-h-[70vh] overflow-y-auto pe-1">
        {open && (
          <BankBrowser
            options={options}
            mode="pick"
            initial={subjectId ? { subjectId } : undefined}
            selected={new Set(picked.keys())}
            onToggle={(it) =>
              setPicked((prev) => {
                const next = new Map(prev);
                if (next.has(it.id)) next.delete(it.id);
                else next.set(it.id, it);
                return next;
              })
            }
          />
        )}
      </div>
    </Dialog>
  );
}

/**
 * Save this quiz's questions into the bank.
 *
 * Filed under the quiz's own subject, class, year and language on the server,
 * so the teacher only says the topic and how hard they are. Only questions the
 * quiz has saved can go — an unsaved edit is not yet a question anywhere.
 */
export function SaveToBankDialog({
  open,
  quizId,
  questions,
  onClose,
}: {
  open: boolean;
  quizId: string;
  questions: BQ[];
  onClose: () => void;
}) {
  const t = useT();
  const saved = questions.filter((q) => !!q.id);
  const [ids, setIds] = useState<Set<string>>(new Set());
  const [topic, setTopic] = useState("");
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>("MEDIUM");
  const [shared, setShared] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (open) setIds(new Set(questions.filter((q) => q.id).map((q) => q.id!)));
  }, [open, questions]);

  async function save() {
    if (ids.size === 0) return;
    setBusy(true);
    try {
      const r = await apiBankFromQuiz({
        quizId,
        questionIds: [...ids],
        topic: topic.trim() || null,
        difficulty,
        shared,
      });
      toast(
        t("questionBank.savedFromQuiz")
          .replace("{added}", String(r.added))
          .replace("{skipped}", String(r.skipped)),
        "success",
      );
      onClose();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save to the bank", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("questionBank.saveTitle")}
      className="max-w-2xl"
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={ids.size === 0 || busy}>
            {t("questionBank.saveN").replace("{n}", String(ids.size))}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5 sm:col-span-1">
            <Label className="text-xs">{t("questionBank.topic")}</Label>
            <Input value={topic} onChange={(e) => setTopic(e.target.value)} maxLength={80} placeholder={t("questionBank.topicHint")} className="h-9" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">{t("questionBank.difficulty")}</Label>
            <Select value={difficulty} onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)} className="h-9">
              {DIFFICULTIES.map((d) => (
                <option key={d} value={d}>{t(DIFF_KEY[d])}</option>
              ))}
            </Select>
          </div>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input type="checkbox" checked={shared} onChange={(e) => setShared(e.target.checked)} />
            {t("questionBank.shareWithColleagues")}
          </label>
        </div>

        {saved.length < questions.length && (
          <p className="rounded-lg border border-amber-300/60 bg-amber-50/60 px-3 py-2 text-xs text-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            {t("questionBank.unsavedSkipped")}
          </p>
        )}

        <ul className="max-h-[45vh] space-y-1.5 overflow-y-auto">
          {saved.map((q, i) => (
            <li key={q.id}>
              <label className="flex cursor-pointer items-start gap-2 rounded-lg border p-2 text-sm hover:bg-secondary/40">
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={ids.has(q.id!)}
                  onChange={() =>
                    setIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(q.id!)) next.delete(q.id!);
                      else next.add(q.id!);
                      return next;
                    })
                  }
                />
                <span className="min-w-0 flex-1">
                  <span className="line-clamp-2" dir="auto">{i + 1}. {q.question}</span>
                  <span className="text-[11px] text-muted-foreground">{TYPE_LABEL[q.questionType]} · {q.marks}</span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </div>
    </Dialog>
  );
}
