"use client";


import { useT } from "@/lib/i18n/provider";
import { useState } from "react";
import { AlertCircle, Check, Loader2, Sparkles, X } from "lucide-react";
import type { AiProposal, InterpretResult } from "@ekulmis/shared";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { applyRules, interpretRule } from "@/lib/timetable/api";
import { toast } from "@/lib/toast";

const EXAMPLES = [
  "Cali cannot teach on Monday",
  "Put Mathematics in the morning",
  "Xasan Talaadada galabta ma joogo",
  "Xisaabta F1 subaxdii u dhig",
];

interface Props {
  academicYearId: string;
  shiftId: string;
  onApplied: () => void;
}

/**
 * Type a rule in plain Somali or English.
 *
 * The model only interprets — it never schedules and never writes. What comes
 * back is restated in plain language and applied only once the admin confirms,
 * so a misread sentence costs a click rather than a school's week.
 */
export function RuleComposer({ academicYearId, shiftId, onApplied }: Props) {
  const t = useT();
  const [text, setText] = useState("");
  const [result, setResult] = useState<InterpretResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function interpret() {
    if (text.trim().length < 3) return;
    setBusy(true);
    setResult(null);
    try {
      setResult(await interpretRule(academicYearId, shiftId, text.trim()));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not read that", "error");
    } finally {
      setBusy(false);
    }
  }

  async function confirm(proposals: AiProposal[]) {
    setBusy(true);
    try {
      const res = await applyRules(academicYearId, proposals);
      toast(
        `Saved ${res.teacherRules + res.subjectRules} rule(s). Generate again to apply them.`,
        "success",
      );
      setText("");
      setResult(null);
      onApplied();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not save", "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-3 rounded-lg border p-4">
      <div>
        <h3 className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles className="h-4 w-4" />
          {t("timetableRuleComposer.askInYourOwnWords")}
        </h3>
        <p className="mt-0.5 text-xs text-muted-foreground">
          {t("timetableRuleComposer.somaliOrEnglishNothingIsSaved")}
        </p>
      </div>

      <Textarea
        rows={2}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={t("timetableRuleComposer.caliCannotTeachOnMonday")}
      />

      <div className="flex flex-wrap gap-1.5">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setText(ex)}
            className="rounded-full border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary"
          >
            {ex}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <Button type="button" onClick={interpret} disabled={busy || text.trim().length < 3}>
          {busy && !result ? (
            <Loader2 className="me-2 h-4 w-4 animate-spin" />
          ) : null}
          {t("timetableRuleComposer.readIt")}
        </Button>
      </div>

      {result && (
        <div className="space-y-2 border-t pt-3">
          {result.summaries.length > 0 && (
            <>
              <p className="text-xs font-medium text-muted-foreground">
                {t("timetableRuleComposer.thisIsWhatItUnderstoodConfirm")}
              </p>
              <ul className="space-y-1">
                {result.summaries.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-3 py-2 text-sm"
                  >
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </>
          )}

          {result.unresolved.map((u, i) => (
            <p
              key={i}
              className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-sm"
            >
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>{u}</span>
            </p>
          ))}

          {result.proposals.length > 0 && (
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setResult(null)}
                disabled={busy}
              >
                <X className="me-1 h-3.5 w-3.5" />
                {t("timetableRuleComposer.discard")}
              </Button>
              <Button
                type="button"
                onClick={() => confirm(result.proposals)}
                disabled={busy}
              >
                {busy ? <Loader2 className="me-2 h-4 w-4 animate-spin" /> : null}
                {t("timetableRuleComposer.confirmAndSave")}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
