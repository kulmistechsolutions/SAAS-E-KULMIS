"use client";

import { useEffect, useState } from "react";
import { History, Loader2, PencilLine, Split } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/lib/i18n/provider";
import { apiQuizHistory, type QuizHistory } from "@/lib/quiz/api";

interface Diff {
  id: string | null;
  kind: "ADDED" | "REMOVED" | "EDITED" | "UNCHANGED";
  before?: { question: string; correctAnswer: string; marks: number };
  after?: { question: string; correctAnswer: string; marks: number };
  fields: string[];
}

/**
 * What has changed on this quiz, and who sat which version.
 *
 * Once a student has sat a paper, any change to it is an event somebody may
 * have to account for later — a mark queried, a result disputed. "The teacher
 * edited it at some point" is not an answer, so this shows the version each
 * change produced, what moved on which question with both sides of it, the
 * reason given, and the name against it.
 */
export function QuizVersionHistory({ quizId }: { quizId: string }) {
  const t = useT();
  const [data, setData] = useState<QuizHistory | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let live = true;
    apiQuizHistory(quizId)
      .then((d) => live && setData(d))
      .catch(() => live && setData(null))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [quizId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-xl border bg-card p-5 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t("common.loading")}
      </div>
    );
  }
  if (!data) return null;

  return (
    <div className="rounded-xl border bg-card p-5">
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          <History className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="font-semibold">{t("quizHistory.title")}</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {t("quizHistory.current").replace("{version}", data.quiz.version)}
          </p>
        </div>
      </div>

      {data.attemptsByVersion.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-2">
          {data.attemptsByVersion.map((a) => (
            <span
              key={a.version}
              className="rounded-full bg-secondary px-3 py-1 text-xs"
            >
              {t("quizHistory.sat")
                .replace("{version}", a.version)
                .replace("{n}", String(a.attempts))}
            </span>
          ))}
        </div>
      )}

      {data.changes.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">
          {t("quizHistory.none")}
        </p>
      ) : (
        <ol className="mt-4 space-y-4">
          {data.changes.map((c) => {
            const correction = c.action === "CORRECTION";
            const diffs = Array.isArray(c.details) ? (c.details as Diff[]) : [];
            return (
              <li key={c.id} className="border-s-2 ps-4">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium",
                      correction
                        ? "bg-sky-500/15 text-sky-700 dark:text-sky-400"
                        : "bg-amber-500/15 text-amber-700 dark:text-amber-400",
                    )}
                  >
                    {correction ? (
                      <PencilLine className="h-3 w-3" />
                    ) : (
                      <Split className="h-3 w-3" />
                    )}
                    v{c.version}
                  </span>
                  <span className="font-medium">{c.summary}</span>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {c.changedByName ?? "—"} ·{" "}
                  {new Date(c.createdAt).toLocaleString()}
                  {c.reason ? ` · ${c.reason}` : ""}
                </p>

                {diffs.filter((d) => d.kind === "EDITED").length > 0 && (
                  <ul className="mt-2 space-y-2">
                    {diffs
                      .filter((d) => d.kind === "EDITED")
                      .map((d, i) => (
                        <li
                          key={d.id ?? i}
                          className="rounded-lg bg-secondary/50 p-2 text-xs"
                        >
                          <p className="text-muted-foreground line-through">
                            {d.before?.question}
                          </p>
                          <p className="mt-0.5 font-medium">{d.after?.question}</p>
                          {d.fields.includes("correctAnswer") && (
                            <p className="mt-1 text-muted-foreground">
                              {t("quizHistory.answerChanged")
                                .replace("{before}", d.before?.correctAnswer ?? "")
                                .replace("{after}", d.after?.correctAnswer ?? "")}
                            </p>
                          )}
                        </li>
                      ))}
                  </ul>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
