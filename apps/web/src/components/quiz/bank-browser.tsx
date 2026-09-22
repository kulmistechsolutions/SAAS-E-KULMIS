"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Lock, Pencil, Search, Trash2, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Pagination } from "@/components/ui/pagination";
import { RichText } from "@/components/quiz/rich-text";
import { QTYPES, TYPE_LABEL } from "@/components/quiz/question-editor";
import {
  apiBankList,
  type BankFilters,
  type BankItem,
  type BankOptions,
  type QuestionDifficulty,
} from "@/lib/quiz/bank-api";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

export const DIFFICULTIES: QuestionDifficulty[] = ["EASY", "MEDIUM", "HARD"];

/** Spelled out, so a difficulty without wording is a build error. */
export const DIFF_KEY = {
  EASY: "questionBank.diff_EASY",
  MEDIUM: "questionBank.diff_MEDIUM",
  HARD: "questionBank.diff_HARD",
} as const;

const LANG_KEY = {
  AUTO: "quiz.language_AUTO",
  so: "quiz.language_so",
  en: "quiz.language_en",
  ar: "quiz.language_ar",
} as const;

const DIFF_STYLE: Record<QuestionDifficulty, string> = {
  EASY: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  HARD: "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-200",
};

/**
 * The bank, searchable by everything a teacher files a question under.
 *
 * One component for the bank page and for picking questions into a quiz, so
 * the filters a teacher learns in one place work the same in the other.
 * Filtering happens on the server: a school's bank grows every term, and
 * fetching all of it to filter in the browser is how a page gets slow on the
 * phones most teachers here use.
 */
export function BankBrowser({
  options,
  mode,
  selected,
  onToggle,
  onEdit,
  onArchive,
  reloadKey = 0,
  initial,
}: {
  options: BankOptions | null;
  mode: "manage" | "pick";
  selected?: Set<string>;
  onToggle?: (item: BankItem) => void;
  onEdit?: (item: BankItem) => void;
  onArchive?: (item: BankItem) => void;
  reloadKey?: number;
  initial?: Partial<BankFilters>;
}) {
  const t = useT();
  const [f, setF] = useState<BankFilters>({ ...initial });
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(mode === "pick" ? 10 : 25);
  const [data, setData] = useState<{ total: number; items: BankItem[] } | null>(null);
  const [loading, setLoading] = useState(false);

  // Typing is not searching: wait for a pause, so each keystroke on a slow
  // connection does not start a request of its own.
  useEffect(() => {
    const h = setTimeout(() => {
      setF((prev) => ({ ...prev, q: search.trim() || undefined }));
      setPage(1);
    }, 350);
    return () => clearTimeout(h);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(
        await apiBankList({ ...f, skip: (page - 1) * pageSize, take: pageSize }),
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load the question bank", "error");
    } finally {
      setLoading(false);
    }
  }, [f, page, pageSize]);

  useEffect(() => {
    void load();
  }, [load, reloadKey]);

  const set = (patch: Partial<BankFilters>) => {
    setF((prev) => ({ ...prev, ...patch }));
    setPage(1);
  };

  const classes = options?.classes.filter(
    (c) => !f.academicYearId || c.academicYearId === f.academicYearId,
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2 rounded-xl border bg-card p-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="relative sm:col-span-2">
          <Search className="pointer-events-none absolute start-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("questionBank.search")}
            className="h-9 ps-8"
          />
        </div>
        <Select value={f.questionType ?? ""} onChange={(e) => set({ questionType: e.target.value || undefined })} className="h-9">
          <option value="">{t("questionBank.allTypes")}</option>
          {QTYPES.map((q) => (
            <option key={q} value={q}>{TYPE_LABEL[q]}</option>
          ))}
        </Select>
        <Select value={f.language ?? ""} onChange={(e) => set({ language: (e.target.value || undefined) as BankFilters["language"] })} className="h-9">
          <option value="">{t("questionBank.allLanguages")}</option>
          <option value="en">{t("quiz.language_en")}</option>
          <option value="ar">{t("quiz.language_ar")}</option>
          <option value="so">{t("quiz.language_so")}</option>
          <option value="AUTO">{t("quiz.language_AUTO")}</option>
        </Select>
        <Select value={f.subjectId ?? ""} onChange={(e) => set({ subjectId: e.target.value || undefined })} className="h-9">
          <option value="">{t("questionBank.allSubjects")}</option>
          {options?.subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name}</option>
          ))}
        </Select>
        <Select value={f.academicYearId ?? ""} onChange={(e) => set({ academicYearId: e.target.value || undefined, classId: undefined })} className="h-9">
          <option value="">{t("questionBank.allYears")}</option>
          {options?.academicYears.map((y) => (
            <option key={y.id} value={y.id}>{y.name}</option>
          ))}
        </Select>
        <Select value={f.classId ?? ""} onChange={(e) => set({ classId: e.target.value || undefined })} className="h-9">
          <option value="">{t("questionBank.allClasses")}</option>
          {classes?.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </Select>
        <Select value={f.topic ?? ""} onChange={(e) => set({ topic: e.target.value || undefined })} className="h-9">
          <option value="">{t("questionBank.allTopics")}</option>
          {options?.topics.map((tp) => (
            <option key={tp} value={tp}>{tp}</option>
          ))}
        </Select>
        <Select value={f.difficulty ?? ""} onChange={(e) => set({ difficulty: (e.target.value || undefined) as BankFilters["difficulty"] })} className="h-9">
          <option value="">{t("questionBank.allDifficulties")}</option>
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>{t(DIFF_KEY[d])}</option>
          ))}
        </Select>
        <Select value={f.teacherId ?? ""} onChange={(e) => set({ teacherId: e.target.value || undefined })} className="h-9">
          <option value="">{t("questionBank.allTeachers")}</option>
          {options?.teachers.map((tc) => (
            <option key={tc.id} value={tc.id}>{tc.fullName}</option>
          ))}
        </Select>
        <label className="flex h-9 items-center gap-2 rounded-lg border px-3 text-sm">
          <input type="checkbox" checked={!!f.mine} onChange={(e) => set({ mine: e.target.checked || undefined })} />
          {t("questionBank.onlyMine")}
        </label>
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          {data ? t("questionBank.count").replace("{n}", String(data.total)) : ""}
        </span>
        {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      </div>

      <ul className="space-y-2">
        {data?.items.map((it) => {
          const picked = selected?.has(it.id);
          return (
            <li
              key={it.id}
              className={cn(
                "rounded-xl border bg-card p-3 transition-colors",
                mode === "pick" && "cursor-pointer hover:bg-secondary/40",
                picked && "border-primary bg-primary/5 ring-1 ring-primary/30",
              )}
              onClick={mode === "pick" ? () => onToggle?.(it) : undefined}
            >
              <div className="flex items-start gap-3">
                {mode === "pick" && (
                  <input
                    type="checkbox"
                    checked={!!picked}
                    onChange={() => onToggle?.(it)}
                    onClick={(e) => e.stopPropagation()}
                    className="mt-1 h-4 w-4 shrink-0"
                    aria-label={t("questionBank.select")}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <RichText
                    as="p"
                    text={it.question}
                    html={it.questionHtml}
                    direction={it.direction}
                    quizDirection={it.language === "ar" ? "RTL" : "AUTO"}
                    font={it.contentFont}
                    className="line-clamp-3 text-sm font-medium"
                  />
                  <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                    <span className="rounded-full bg-primary/10 px-2 py-0.5 font-medium text-primary">
                      {TYPE_LABEL[it.questionType as keyof typeof TYPE_LABEL] ?? it.questionType}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5", DIFF_STYLE[it.difficulty])}>
                      {t(DIFF_KEY[it.difficulty])}
                    </span>
                    {it.language !== "AUTO" && (
                      <span className="rounded-full bg-secondary px-2 py-0.5">
                        {t(LANG_KEY[it.language])}
                      </span>
                    )}
                    {it.subjectName && <span className="rounded-full bg-secondary px-2 py-0.5">{it.subjectName}</span>}
                    {it.className && <span className="rounded-full bg-secondary px-2 py-0.5">{it.className}</span>}
                    {it.topic && <span className="rounded-full bg-secondary px-2 py-0.5">#{it.topic}</span>}
                    <span className="text-muted-foreground">· {it.marks} {t("questionBank.marks")}</span>
                    <span className="text-muted-foreground">· {it.teacherName ?? "—"}</span>
                    <span className="inline-flex items-center gap-0.5 text-muted-foreground" title={it.shared ? t("questionBank.shared") : t("questionBank.private")}>
                      {it.shared ? <Users className="h-3 w-3" /> : <Lock className="h-3 w-3" />}
                    </span>
                    {it.usageCount > 0 && (
                      <span className="text-muted-foreground">
                        · {t("questionBank.used").replace("{n}", String(it.usageCount))}
                      </span>
                    )}
                  </div>
                </div>
                {mode === "manage" && it.canEdit && (
                  <div className="flex shrink-0 gap-1">
                    <Button variant="ghost" className="h-8 w-8 p-0" onClick={() => onEdit?.(it)} aria-label={t("questionBank.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" className="h-8 w-8 p-0 text-rose-600" onClick={() => onArchive?.(it)} aria-label={t("questionBank.remove")}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </div>
            </li>
          );
        })}
        {data && data.items.length === 0 && (
          <li className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
            {t("questionBank.empty")}
          </li>
        )}
      </ul>

      {data && data.total > pageSize && (
        <Pagination
          page={page}
          pageCount={Math.max(1, Math.ceil(data.total / pageSize))}
          pageSize={pageSize}
          total={data.total}
          onPageChange={setPage}
          onPageSizeChange={(n: number) => {
            setPageSize(n);
            setPage(1);
          }}
        />
      )}
    </div>
  );
}
