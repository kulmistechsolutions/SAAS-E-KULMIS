"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, ShieldCheck, TriangleAlert, UserCog } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  apiListAttendanceOfficers,
  apiListAttendanceShifts,
  apiSetAttendanceAssignments,
  type ApiShift,
  type AttendanceOfficer,
  type GrantInput,
} from "@/lib/attendance/api";
import { activeAcademicYear, useAcademicsState } from "@/lib/academics/store";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

/**
 * Where each attendance officer is allowed to work.
 *
 * The grant is per class, and a school may narrow it to one section, one
 * shift, or both. Left alone, a class covers all of its sections and every
 * shift — which is how schools actually think about it ("Grade 1, mornings"),
 * so that is the default rather than something to be assembled tick by tick.
 */
export default function AttendanceOfficersPage() {
  const t = useT();
  const academics = useAcademicsState();
  const [officers, setOfficers] = useState<AttendanceOfficer[]>([]);
  const [shifts, setShifts] = useState<ApiShift[]>([]);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Map<string, GrantInput>>(new Map());
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [o, s] = await Promise.all([
        apiListAttendanceOfficers(),
        apiListAttendanceShifts().catch(() => [] as ApiShift[]),
      ]);
      setOfficers(o);
      setShifts(s.filter((x) => x.status === "ACTIVE"));
    } catch {
      toast(t("attendanceOfficers.loadFailed"), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  const year = activeAcademicYear();
  const classes = useMemo(
    () =>
      academics.classes
        .filter((c) => c.academicYear === year && c.status === "ACTIVE")
        .sort((a, b) => a.orderIndex - b.orderIndex),
    [academics.classes, year],
  );
  const sectionsOf = useCallback(
    (classId: string) => academics.sections.filter((s) => s.classId === classId),
    [academics.sections],
  );

  const key = (g: GrantInput) =>
    `${g.classId}|${g.sectionId ?? ""}|${g.shiftId ?? ""}`;

  function startEdit(o: AttendanceOfficer) {
    const m = new Map<string, GrantInput>();
    for (const a of o.assignments) {
      const g = { classId: a.classId, sectionId: a.sectionId, shiftId: a.shiftId };
      m.set(key(g), g);
    }
    setDraft(m);
    setEditing(o.id);
  }

  function toggle(g: GrantInput) {
    setDraft((prev) => {
      const next = new Map(prev);
      const k = key(g);
      if (next.has(k)) next.delete(k);
      else next.set(k, g);
      return next;
    });
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    try {
      const res = await apiSetAttendanceAssignments(editing, [...draft.values()]);
      // A conflict is reported, not refused — a school may deliberately put
      // two officers on one register, but should know it has.
      if (res.conflicts.length > 0) {
        toast(
          t("attendanceOfficers.savedWithConflicts", {
            count: res.count,
            conflicts: res.conflicts.length,
          }),
          "info",
        );
      } else {
        toast(t("attendanceOfficers.saved", { count: res.count }), "success");
      }
      setEditing(null);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : t("attendanceOfficers.saveFailed"), "error");
    } finally {
      setSaving(false);
    }
  }

  const current = officers.find((o) => o.id === editing) ?? null;

  return (
    <div className="space-y-6">
      <Link
        href="/attendance"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("attendanceOfficers.back")}
      </Link>

      <div>
        <h1 className="flex items-center gap-2 text-2xl font-bold">
          <ShieldCheck className="h-6 w-6 text-primary" />
          {t("attendanceOfficers.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("attendanceOfficers.description")}
        </p>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("attendanceOfficers.loading")}</p>
      ) : officers.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <UserCog className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("attendanceOfficers.noneTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("attendanceOfficers.noneHelp")}
          </p>
          <Link href="/users" className="mt-4 inline-block">
            <Button variant="outline" className="h-9">
              {t("attendanceOfficers.goToUsers")}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border">
          <table className="w-full text-sm">
            <thead className="bg-secondary text-start text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceOfficers.officer")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceOfficers.assigned")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("attendanceOfficers.status")}
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {officers.map((o) => (
                <tr key={o.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{o.fullName || o.username}</p>
                    <p className="text-xs text-muted-foreground">{o.username}</p>
                  </td>
                  <td className="px-4 py-3">
                    {o.assignments.length === 0 ? (
                      // Worth saying plainly: an officer with no grants can
                      // reach nothing, which looks like a broken account
                      // rather than an unfinished setup.
                      <span className="text-xs text-amber-600 dark:text-amber-400">
                        {t("attendanceOfficers.nothingAssigned")}
                      </span>
                    ) : (
                      <div className="flex flex-wrap gap-1.5">
                        {o.assignments.slice(0, 6).map((a) => (
                          <Badge key={a.id} tone="muted">
                            {a.class.name}
                            {a.section ? ` · ${a.section.name}` : ""}
                            {a.shift ? ` · ${a.shift.name}` : ""}
                          </Badge>
                        ))}
                        {o.assignments.length > 6 && (
                          <Badge tone="muted">+{o.assignments.length - 6}</Badge>
                        )}
                      </div>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={o.status === "ACTIVE" ? "success" : "muted"}>
                      {o.status}
                    </Badge>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => startEdit(o)}
                    >
                      {t("attendanceOfficers.assign")}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {current && (
        <div className="rounded-xl border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">
                {t("attendanceOfficers.assigningFor", {
                  name: current.fullName || current.username,
                })}
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {t("attendanceOfficers.assignHelp")}
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="h-9" onClick={() => setEditing(null)}>
                {t("attendanceOfficers.cancel")}
              </Button>
              <Button className="h-9" disabled={saving} onClick={() => void save()}>
                {saving ? t("attendanceOfficers.saving") : t("attendanceOfficers.save")}
              </Button>
            </div>
          </div>

          {draft.size === 0 && (
            <p className="mt-4 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-400">
              <TriangleAlert className="h-4 w-4 shrink-0" />
              {t("attendanceOfficers.emptyWarning")}
            </p>
          )}

          <div className="mt-4 space-y-3">
            {classes.map((c) => {
              const secs = sectionsOf(c.id);
              const wholeClass = { classId: c.id, sectionId: null, shiftId: null };
              return (
                <div key={c.id} className="rounded-lg border p-3">
                  <label className="flex items-center gap-2 text-sm font-medium">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={draft.has(key(wholeClass))}
                      onChange={() => toggle(wholeClass)}
                    />
                    {c.name}
                    <span className="text-xs font-normal text-muted-foreground">
                      {t("attendanceOfficers.wholeClass")}
                    </span>
                  </label>

                  {/* Narrower grants, for a school that wants them. Ticking the
                      whole class above already covers all of this; these are
                      for the case where it should not. */}
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 ps-6">
                    {shifts.map((sh) => {
                      const g = { classId: c.id, sectionId: null, shiftId: sh.id };
                      return (
                        <label key={sh.id} className="flex items-center gap-1.5 text-xs">
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={draft.has(key(g))}
                            onChange={() => toggle(g)}
                          />
                          {sh.name}
                        </label>
                      );
                    })}
                    {secs.map((sec) => {
                      const g = { classId: c.id, sectionId: sec.id, shiftId: null };
                      return (
                        <label
                          key={sec.id}
                          className={cn("flex items-center gap-1.5 text-xs")}
                        >
                          <input
                            type="checkbox"
                            className="h-3.5 w-3.5"
                            checked={draft.has(key(g))}
                            onChange={() => toggle(g)}
                          />
                          {t("attendanceOfficers.sectionLabel", { name: sec.name })}
                        </label>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
