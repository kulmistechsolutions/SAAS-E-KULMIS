"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, PencilLine, Split } from "lucide-react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";

export type QuizEditMode = "CORRECTION" | "NEW_VERSION";

/**
 * Which kind of change this is, asked once, before it happens.
 *
 * A teacher fixing a spelling mistake and a teacher rewriting question 5 are
 * doing two different things, and the difference decides what a student who
 * already sat the paper is shown. Correcting in place is right for the first:
 * they sat that question, only misspelt. It is wrong for the second — their
 * answer was to the old question, and showing them the new one beside their
 * old answer makes them look wrong when they were not.
 *
 * The screen has to make that distinction easy to get right, so each option
 * says what happens to the students who have already sat it rather than
 * naming a version number and leaving them to work it out.
 */
export function QuizEditModeDialog({
  open,
  attemptCount,
  version,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  attemptCount: number;
  version: string;
  onCancel: () => void;
  onConfirm: (mode: QuizEditMode, reason: string) => void;
}) {
  const t = useT();
  const [mode, setMode] = useState<QuizEditMode>("CORRECTION");
  const [reason, setReason] = useState("");

  useEffect(() => {
    if (open) {
      setMode("CORRECTION");
      setReason("");
    }
  }, [open]);

  const next =
    mode === "NEW_VERSION"
      ? `${Number(version.split(".")[0] ?? 1) + 1}.0`
      : `${version.split(".")[0] ?? 1}.${Number(version.split(".")[1] ?? 0) + 1}`;

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      title={t("quizEditMode.title")}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onCancel}>
            {t("common.cancel")}
          </Button>
          <Button onClick={() => onConfirm(mode, reason.trim())}>
            {t("quizEditMode.save").replace("{version}", next)}
          </Button>
        </>
      }
    >
      <div className="space-y-4 text-sm">
        <div className="flex items-start gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            {t("quizEditMode.alreadySat")
              .replace("{n}", String(attemptCount))
              .replace("{version}", version)}
          </p>
        </div>

        <Choice
          on={mode === "CORRECTION"}
          onPick={() => setMode("CORRECTION")}
          icon={PencilLine}
          title={t("quizEditMode.correctionTitle")}
          body={t("quizEditMode.correctionBody")}
          effect={t("quizEditMode.correctionEffect")}
        />

        <Choice
          on={mode === "NEW_VERSION"}
          onPick={() => setMode("NEW_VERSION")}
          icon={Split}
          title={t("quizEditMode.newVersionTitle")}
          body={t("quizEditMode.newVersionBody")}
          effect={t("quizEditMode.newVersionEffect")}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            {t("quizEditMode.reason")}
          </label>
          <input
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("quizEditMode.reasonHint")}
            maxLength={300}
            className="h-10 w-full rounded-lg border bg-background px-3 text-sm outline-none focus:border-primary"
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("quizEditMode.reasonHelp")}
          </p>
        </div>
      </div>
    </Dialog>
  );
}

function Choice({
  on,
  onPick,
  icon: Icon,
  title,
  body,
  effect,
}: {
  on: boolean;
  onPick: () => void;
  icon: typeof PencilLine;
  title: string;
  body: string;
  effect: string;
}) {
  return (
    <button
      type="button"
      onClick={onPick}
      className={cn(
        "flex w-full gap-3 rounded-xl border p-3 text-start transition-all",
        on ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "hover:bg-secondary/50",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
          on ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0">
        <span className="block font-medium">{title}</span>
        <span className="mt-0.5 block text-xs text-muted-foreground">{body}</span>
        <span className="mt-1 block text-xs font-medium text-foreground/80">
          {effect}
        </span>
      </span>
    </button>
  );
}
