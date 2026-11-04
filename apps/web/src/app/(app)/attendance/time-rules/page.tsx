"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Clock, Pencil, Plus, Trash2 } from "lucide-react";
import { effectiveAttendanceTimes } from "@ekulmis/shared";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import {
  apiAssignAttendanceTimeRule,
  apiDeleteAttendanceTimeRule,
  apiListAttendanceTimeRules,
  apiSaveAttendanceTimeRule,
  type ApiAttendanceTimeRule,
  type ApiAttendanceTimeRules,
  type ApiAttendanceTimes,
} from "@/lib/attendance/api";
import { toast } from "@/lib/toast";
import { useHydrated } from "@/lib/use-hydrated";
import { cn } from "@/lib/utils";

interface FormState {
  name: string;
  mode: "SHIFTED" | "FIXED";
  offsetMinutes: number;
  startTime: string;
  lateTime: string;
  endTime: string;
  lockTime: string;
  classIds: string[];
}

/** Earlier first: an early session is the case this page exists for. */
const OFFSETS = [-180, -120, -90, -70, -60, -45, -30, -15, 15, 30, 45, 60, 90, 120, 180];

const TIME_KEYS = ["startTime", "lateTime", "endTime", "lockTime"] as const;
const TIME_LABEL = {
  startTime: "attendanceTimeRules.start",
  lateTime: "attendanceTimeRules.late",
  endTime: "attendanceTimeRules.end",
  lockTime: "attendanceTimeRules.lock",
} as const;

export default function AttendanceTimeRulesPage() {
  const t = useT();
  const mounted = useHydrated();
  const [data, setData] = useState<ApiAttendanceTimeRules | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ApiAttendanceTimeRule | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ApiAttendanceTimeRule | null>(null);

  const refresh = () => {
    setLoading(true);
    return apiListAttendanceTimeRules()
      .then(setData)
      .catch((e) => toast(e instanceof Error ? e.message : String(e), "error"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (mounted) void refresh();
  }, [mounted]);

  const duration = (m: number) => {
    const abs = Math.abs(m);
    const h = Math.floor(abs / 60);
    const min = abs % 60;
    return [
      h ? t("attendanceTimeRules.hours", { n: h }) : "",
      min ? t("attendanceTimeRules.minutes", { n: min }) : "",
    ]
      .filter(Boolean)
      .join(" ");
  };
  const offsetLabel = (m: number) =>
    m < 0
      ? t("attendanceTimeRules.earlier", { time: duration(m) })
      : t("attendanceTimeRules.later", { time: duration(m) });

  function openForm(rule: ApiAttendanceTimeRule | null) {
    const school = data?.school;
    setEditing(rule);
    setForm({
      name: rule?.name ?? "",
      mode: rule?.mode ?? "SHIFTED",
      offsetMinutes: rule?.mode === "SHIFTED" ? rule.offsetMinutes : -60,
      startTime: rule?.times.startTime ?? school?.startTime ?? "07:00",
      lateTime: rule?.times.lateTime ?? school?.lateTime ?? "07:30",
      endTime: rule?.times.endTime ?? school?.endTime ?? "14:00",
      lockTime: rule?.times.lockTime ?? school?.lockTime ?? "16:00",
      classIds: rule?.classes.map((c) => c.id) ?? [],
    });
    setFormOpen(true);
  }

  // What the rule will actually do, worked out by the same function the
  // server enforces with.
  const preview: ApiAttendanceTimes | null = useMemo(() => {
    if (!form || !data) return null;
    return effectiveAttendanceTimes(data.school, {
      mode: form.mode,
      offsetMinutes: form.offsetMinutes,
      startTime: form.startTime || null,
      lateTime: form.lateTime || null,
      endTime: form.endTime || null,
      lockTime: form.lockTime || null,
    });
  }, [form, data]);

  const ruleName = useMemo(
    () => new Map((data?.rules ?? []).map((r) => [r.id, r.name])),
    [data],
  );

  async function handleSave() {
    if (!form) return;
    const name = form.name.trim();
    if (!name) return toast(t("attendanceTimeRules.nameRequired"), "error");
    setSaving(true);
    try {
      const saved = await apiSaveAttendanceTimeRule(editing?.id ?? null, {
        name,
        mode: form.mode,
        offsetMinutes: form.mode === "SHIFTED" ? form.offsetMinutes : 0,
        ...(form.mode === "FIXED"
          ? {
              startTime: form.startTime || null,
              lateTime: form.lateTime || null,
              endTime: form.endTime || null,
              lockTime: form.lockTime || null,
            }
          : {}),
      });
      await apiAssignAttendanceTimeRule(saved.id, form.classIds);
      toast(t("attendanceTimeRules.saved"), "success");
      setFormOpen(false);
      void refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiDeleteAttendanceTimeRule(deleting.id);
      toast(t("attendanceTimeRules.deleted"), "success");
      void refresh();
    } catch (e) {
      toast(e instanceof Error ? e.message : String(e), "error");
    } finally {
      setDeleting(null);
    }
  }

  const toggleClass = (id: string) =>
    setForm((f) =>
      f
        ? {
            ...f,
            classIds: f.classIds.includes(id)
              ? f.classIds.filter((x) => x !== id)
              : [...f.classIds, id],
          }
        : f,
    );

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        {t("attendanceTimeRules.loading")}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("attendanceStudents.backToAttendance")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="max-w-2xl">
          <h1 className="text-2xl font-bold">{t("attendanceTimeRules.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendanceTimeRules.description")}
          </p>
        </div>
        <Button onClick={() => openForm(null)} disabled={!data}>
          <Plus className="me-2 h-4 w-4" /> {t("attendanceTimeRules.addRule")}
        </Button>
      </div>

      {data && (
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-sm font-medium">{t("attendanceTimeRules.schoolTimes")}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("attendanceTimeRules.schoolTimesHint")}
          </p>
          <TimesRow times={data.school} />
        </div>
      )}

      <div className="space-y-3">
        {loading && !data ? (
          <div className="flex h-40 items-center justify-center text-muted-foreground">
            {t("attendanceTimeRules.loading")}
          </div>
        ) : data && data.rules.length === 0 ? (
          <div className="flex flex-col items-center gap-3 rounded-2xl border bg-card px-6 py-14 text-center shadow-sm">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-muted-foreground">
              <Clock className="h-7 w-7" />
            </span>
            <div>
              <p className="font-medium">{t("attendanceTimeRules.noRulesYet")}</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {t("attendanceTimeRules.noRulesHint")}
              </p>
            </div>
            <Button onClick={() => openForm(null)} className="mt-2">
              <Plus className="me-2 h-4 w-4" /> {t("attendanceTimeRules.addRule")}
            </Button>
          </div>
        ) : (
          data?.rules.map((r) => (
            <div key={r.id} className="rounded-2xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="font-semibold">{r.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {r.mode === "SHIFTED"
                      ? offsetLabel(r.offsetMinutes)
                      : t("attendanceTimeRules.modeFixed")}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => openForm(r)}
                    aria-label={t("attendanceTimeRules.editRule")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-primary hover:bg-primary/10"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleting(r)}
                    aria-label={t("common.delete")}
                    className="flex h-8 w-8 items-center justify-center rounded-lg text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
              <TimesRow times={r.times} />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {r.classes.length === 0 ? (
                  <span className="text-xs text-muted-foreground">
                    {t("attendanceTimeRules.noClasses")}
                  </span>
                ) : (
                  r.classes.map((c) => (
                    <Badge key={c.id} tone="info">
                      {c.name}
                    </Badge>
                  ))
                )}
              </div>
            </div>
          ))
        )}
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? t("attendanceTimeRules.editRule") : t("attendanceTimeRules.addRule")}
        className="max-w-lg"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)} disabled={saving}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? t("attendanceTimeRules.saving") : t("attendanceTimeRules.save")}
            </Button>
          </>
        }
      >
        {form && data && (
          <div className="space-y-5 text-sm">
            <div>
              <label className="mb-1 block text-xs font-medium text-muted-foreground">
                {t("attendanceTimeRules.name")} *
              </label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={t("attendanceTimeRules.namePlaceholder")}
                maxLength={60}
              />
            </div>

            <fieldset className="space-y-2">
              <legend className="mb-1 text-xs font-medium text-muted-foreground">
                {t("attendanceTimeRules.how")}
              </legend>
              {(["SHIFTED", "FIXED"] as const).map((m) => (
                <label
                  key={m}
                  className={cn(
                    "flex cursor-pointer gap-3 rounded-xl border p-3",
                    form.mode === m ? "border-primary bg-primary/5" : "hover:bg-secondary/60",
                  )}
                >
                  <input
                    type="radio"
                    name="mode"
                    checked={form.mode === m}
                    onChange={() => setForm({ ...form, mode: m })}
                    className="mt-0.5"
                  />
                  <span>
                    <span className="block font-medium">
                      {m === "SHIFTED"
                        ? t("attendanceTimeRules.modeShifted")
                        : t("attendanceTimeRules.modeFixed")}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {m === "SHIFTED"
                        ? t("attendanceTimeRules.modeShiftedHint")
                        : t("attendanceTimeRules.modeFixedHint")}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>

            {form.mode === "SHIFTED" ? (
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("attendanceTimeRules.shiftBy")}
                </label>
                <select
                  value={form.offsetMinutes}
                  onChange={(e) => setForm({ ...form, offsetMinutes: Number(e.target.value) })}
                  className="h-10 w-full rounded-lg border border-input bg-background px-3"
                >
                  {OFFSETS.map((m) => (
                    <option key={m} value={m}>
                      {offsetLabel(m)}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {TIME_KEYS.map((k) => (
                  <div key={k}>
                    <label className="mb-1 block text-xs font-medium text-muted-foreground">
                      {t(TIME_LABEL[k])}
                      {k === "startTime" || k === "lockTime" ? " *" : ""}
                    </label>
                    <Input
                      type="time"
                      value={form[k]}
                      onChange={(e) => setForm({ ...form, [k]: e.target.value })}
                    />
                  </div>
                ))}
              </div>
            )}

            {preview && (
              <div className="rounded-xl bg-secondary/60 p-3">
                <p className="text-xs font-medium text-muted-foreground">
                  {t("attendanceTimeRules.result")}
                </p>
                <TimesRow times={preview} />
                <p className="mt-2 text-xs text-muted-foreground">
                  {t("attendanceTimeRules.lockNote")}
                </p>
              </div>
            )}

            <div>
              <p className="text-xs font-medium text-muted-foreground">
                {t("attendanceTimeRules.classes")}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                {t("attendanceTimeRules.classesHint")}
              </p>
              {data.classes.length === 0 ? (
                <p className="text-xs text-muted-foreground">{t("attendanceTimeRules.noClasses")}</p>
              ) : (
                <div className="grid max-h-56 grid-cols-1 gap-1 overflow-y-auto rounded-xl border p-2 sm:grid-cols-2">
                  {data.classes.map((c) => {
                    const other =
                      c.ruleId && c.ruleId !== editing?.id ? ruleName.get(c.ruleId) : null;
                    return (
                      <label
                        key={c.id}
                        className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-secondary/60"
                      >
                        <input
                          type="checkbox"
                          checked={form.classIds.includes(c.id)}
                          onChange={() => toggleClass(c.id)}
                        />
                        <span className="flex-1">{c.name}</span>
                        {other && !form.classIds.includes(c.id) && (
                          <span className="text-[11px] text-muted-foreground">
                            {t("attendanceTimeRules.onOtherRule", { rule: other })}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title={t("common.delete")}
        message={t("attendanceTimeRules.deleteConfirm", { name: deleting?.name ?? "" })}
        confirmLabel={t("common.delete")}
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}

function TimesRow({ times }: { times: ApiAttendanceTimes }) {
  const t = useT();
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
      {TIME_KEYS.map((k) => (
        <div key={k} className="rounded-lg border bg-background px-3 py-2">
          <dt className="text-[11px] text-muted-foreground">{t(TIME_LABEL[k])}</dt>
          <dd className={cn("font-semibold tabular-nums", k === "lockTime" && "text-primary")}>
            {times[k]}
          </dd>
        </div>
      ))}
    </dl>
  );
}
