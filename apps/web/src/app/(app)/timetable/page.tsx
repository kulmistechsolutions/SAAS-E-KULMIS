"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CalendarClock,
  CheckCircle2,
  Download,
  Info,
  Loader2,
  Settings2,
  Sparkles,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { TimetableGrid } from "@/components/timetable/timetable-grid";
import {
  deleteTimetable,
  downloadTimetablePdf,
  fetchShifts,
  fetchTimetable,
  fetchTimetables,
  generateTimetable,
  publishTimetable,
  type ShiftDto,
  type TimetableDetail,
  type TimetableSummary,
} from "@/lib/timetable/api";
import { ensureAcademicsLoaded, useAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

const STATUS_TONE: Record<TimetableSummary["status"], string> = {
  DRAFT: "bg-secondary text-muted-foreground",
  PUBLISHED: "bg-emerald-500/12 text-emerald-600 dark:text-emerald-400",
  ARCHIVED: "bg-secondary text-muted-foreground line-through",
};

export default function TimetablePage() {
  const academics = useAcademicsState();
  const [yearId, setYearId] = useState("");
  const [shifts, setShifts] = useState<ShiftDto[]>([]);
  const [list, setList] = useState<TimetableSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TimetableDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState<string | null>(null);

  useEffect(() => {
    void ensureAcademicsLoaded();
  }, []);

  const years = academics.academicYears;
  useEffect(() => {
    if (yearId || years.length === 0) return;
    setYearId(years.find((y) => y.status === "ACTIVE")?.id ?? years[0]!.id);
  }, [years, yearId]);

  const reload = useCallback(async () => {
    if (!yearId) return;
    setLoading(true);
    try {
      const [s, l] = await Promise.all([fetchShifts(yearId), fetchTimetables(yearId)]);
      setShifts(s);
      setList(l);
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load timetables", "error");
    } finally {
      setLoading(false);
    }
  }, [yearId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    if (!openId) {
      setDetail(null);
      return;
    }
    void fetchTimetable(openId)
      .then(setDetail)
      .catch((e) =>
        toast(e instanceof Error ? e.message : "Could not open timetable", "error"),
      );
  }, [openId]);

  async function handleGenerate(shift: ShiftDto) {
    setGenerating(shift.id);
    try {
      const res = await generateTimetable(yearId, shift.id);
      toast(`${res.lessons} lessons placed with no clashes`, "success");
      await reload();
      setOpenId(res.timetableId);
    } catch (e) {
      // The solver's own explanation is the useful part — show it in full.
      toast(e instanceof Error ? e.message : "Generation failed", "error");
    } finally {
      setGenerating(null);
    }
  }

  async function handlePublish(id: string) {
    try {
      await publishTimetable(id);
      toast("Timetable published", "success");
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not publish", "error");
    }
  }

  async function handleDownload(t: TimetableSummary) {
    try {
      await downloadTimetablePdf(
        t.id,
        `timetable-${t.shift.name.toLowerCase()}.pdf`,
      );
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not download", "error");
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteTimetable(id);
      toast("Timetable deleted", "success");
      if (openId === id) setOpenId(null);
      await reload();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not delete", "error");
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <CalendarClock className="h-6 w-6" />
            Timetable
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a clash-free week, review it, then publish.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-44">
            <Select value={yearId} onChange={(e) => setYearId(e.target.value)}>
              {years.map((y) => (
                <option key={y.id} value={y.id}>
                  {y.name}
                </option>
              ))}
            </Select>
          </div>
          <Link href="/timetable/setup">
            <Button variant="outline">
              <Settings2 className="mr-2 h-4 w-4" />
              Setup
            </Button>
          </Link>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-12 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading…
        </div>
      ) : shifts.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center">
          <p className="text-sm text-muted-foreground">
            No shift set up yet. Describe your school week first.
          </p>
          <Link href="/timetable/setup" className="mt-3 inline-block">
            <Button>Go to setup</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            {shifts.map((shift) => (
              <Button
                key={shift.id}
                type="button"
                onClick={() => handleGenerate(shift)}
                disabled={generating !== null}
              >
                {generating === shift.id ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="mr-2 h-4 w-4" />
                )}
                {generating === shift.id
                  ? "Working…"
                  : `Generate — ${shift.name}`}
              </Button>
            ))}
          </div>

          {list.length === 0 ? (
            <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nothing generated yet.
            </p>
          ) : (
            <div className="space-y-2">
              {list.map((t) => (
                <div key={t.id} className="rounded-lg border">
                  <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
                    <button
                      type="button"
                      onClick={() => setOpenId(openId === t.id ? null : t.id)}
                      className="text-left"
                    >
                      <span className="font-medium">{t.name}</span>
                      <span
                        className={cn(
                          "ml-2 rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_TONE[t.status],
                        )}
                      >
                        {t.status}
                      </span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {t.shift.name} · {t._count.entries} lessons
                      </span>
                    </button>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => setOpenId(openId === t.id ? null : t.id)}
                      >
                        {openId === t.id ? "Hide" : "View"}
                      </Button>
                      {t.status !== "PUBLISHED" && (
                        <Button
                          type="button"
                          className="h-8 px-3 text-xs"
                          onClick={() => handlePublish(t.id)}
                        >
                          <CheckCircle2 className="mr-1 h-3.5 w-3.5" />
                          Publish
                        </Button>
                      )}
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleDownload(t)}
                      >
                        <Download className="mr-1 h-3.5 w-3.5" />
                        PDF
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => handleDelete(t.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  {openId === t.id && (
                    <div className="border-t p-4">
                      {t.notes && (
                        <p className="mb-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs">
                          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400" />
                          <span className="whitespace-pre-line">{t.notes}</span>
                        </p>
                      )}
                      {detail && detail.id === t.id ? (
                        <TimetableGrid timetable={detail} />
                      ) : (
                        <div className="flex items-center gap-2 py-6 text-muted-foreground">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Loading…
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
