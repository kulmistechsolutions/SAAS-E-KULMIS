"use client";

import { useEffect, useMemo, useState } from "react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";
import { classesForYear, sectionsForClass } from "@/lib/academics/store";
import { toast } from "@/lib/toast";

/**
 * Which classes one person covers.
 *
 * Scope stopped being an attendance idea the moment it began deciding fee
 * lists and student directories, but the only place to set it was still the
 * attendance officers screen — so a school scoping a finance clerk had to go
 * looking for it under attendance, and would not have thought to.
 *
 * Empty means two different things and the card says which, because getting
 * it backwards is the difference between a person seeing nothing and a person
 * seeing everything: a role scoped by its nature (an officer, a teacher) with
 * no classes reaches nothing, and any other role with no classes reaches the
 * whole school.
 */

interface Grant {
  classId: string;
  sectionId: string | null;
  class?: { id: string; name: string };
  section?: { id: string; name: string } | null;
}

/** Roles held to their grants even when they have none. */
const NARROW_WHEN_EMPTY = ["ATTENDANCE_OFFICER", "TEACHER"];

export function UserScopeCard({
  userId,
  role,
  academicYear,
}: {
  userId: string;
  role: string;
  academicYear?: string;
}) {
  const t = useT();
  const [grants, setGrants] = useState<Grant[] | null>(null);
  const [saving, setSaving] = useState(false);

  const classes = useMemo(
    () => classesForYear(academicYear),
    [academicYear],
  );

  useEffect(() => {
    let alive = true;
    api<Grant[]>(`/users/${userId}/scope`)
      .then((rows) => alive && setGrants(rows))
      .catch(() => alive && setGrants([]));
    return () => {
      alive = false;
    };
  }, [userId]);

  const chosen = useMemo(
    () => new Set((grants ?? []).map((g) => `${g.classId}|${g.sectionId ?? ""}`)),
    [grants],
  );

  function toggleClass(classId: string) {
    setGrants((prev) => {
      const rows = prev ?? [];
      const has = rows.some((g) => g.classId === classId && g.sectionId === null);
      // Choosing the whole class clears any section of it that was ticked:
      // "Grade 8" and "Grade 8 Section A" together mean all of Grade 8, and
      // showing both ticked would suggest otherwise.
      const without = rows.filter((g) => g.classId !== classId);
      return has ? without : [...without, { classId, sectionId: null }];
    });
  }

  function toggleSection(classId: string, sectionId: string) {
    setGrants((prev) => {
      const rows = prev ?? [];
      const has = rows.some(
        (g) => g.classId === classId && g.sectionId === sectionId,
      );
      const wholeClass = rows.filter(
        (g) => g.classId === classId && g.sectionId === null,
      );
      const rest = rows.filter(
        (g) => !(g.classId === classId && g.sectionId === sectionId),
      );
      if (has) return rest;
      // Picking a section replaces a whole-class grant on the same class.
      return [
        ...rest.filter((g) => !wholeClass.includes(g)),
        { classId, sectionId },
      ];
    });
  }

  async function save() {
    setSaving(true);
    try {
      await api(`/users/${userId}/scope`, {
        method: "PUT",
        body: {
          assignments: (grants ?? []).map((g) => ({
            classId: g.classId,
            sectionId: g.sectionId,
          })),
        },
      });
      toast(t("usersScope.saved"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (grants === null) {
    return (
      <div className="rounded-2xl border bg-card p-6 text-sm text-muted-foreground">
        {t("usersScope.loading")}
      </div>
    );
  }

  const empty = grants.length === 0;
  const narrows = NARROW_WHEN_EMPTY.includes(role);

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{t("usersScope.title")}</h2>
          <p className="mt-1 max-w-prose text-sm text-muted-foreground">
            {t("usersScope.intro")}
          </p>
        </div>
        <Button onClick={save} disabled={saving} className="h-9">
          {t("usersScope.save")}
        </Button>
      </div>

      {/* The empty case is the one people get backwards, so it says which. */}
      <p
        className={
          empty
            ? "mt-4 rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200"
            : "mt-4 rounded-lg border bg-secondary/40 p-3 text-sm text-muted-foreground"
        }
      >
        {empty
          ? narrows
            ? t("usersScope.emptyNarrow")
            : t("usersScope.emptyWide")
          : t("usersScope.chosen").replace("{n}", String(grants.length))}
      </p>

      <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {classes.map((c) => {
          const wholeClass = chosen.has(`${c.id}|`);
          const sections = sectionsForClass(c.id);
          return (
            <div key={c.id} className="rounded-xl border p-3">
              <label className="flex cursor-pointer items-center gap-2 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={wholeClass}
                  onChange={() => toggleClass(c.id)}
                  className="h-4 w-4 accent-primary"
                />
                {c.name}
              </label>
              {sections.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2 ps-6">
                  {sections.map((sec) => (
                    <label
                      key={sec.id}
                      className="flex cursor-pointer items-center gap-1.5 text-xs text-muted-foreground"
                    >
                      <input
                        type="checkbox"
                        checked={wholeClass || chosen.has(`${c.id}|${sec.id}`)}
                        disabled={wholeClass}
                        onChange={() => toggleSection(c.id, sec.id)}
                        className="h-3.5 w-3.5 accent-primary"
                      />
                      {sec.name}
                    </label>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
