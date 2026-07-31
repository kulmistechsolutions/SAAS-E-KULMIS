"use client";

import { useEffect, useState } from "react";
import { Copy, Loader2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { SettingsToggle } from "@/components/settings/settings-toggle";
import { AcademicStructureBuilder } from "@/components/settings/academic-structure-builder";
import { useAcademicsState } from "@/lib/academics/store";
import { apiListYears } from "@/lib/academics/api";
import {
  apiCloneStructure,
  apiGetStructureSettings,
  apiUpdateStructureSettings,
  type AcademicStructureSettings,
} from "@/lib/academics/structure-api";
import { toast } from "@/lib/toast";

/**
 * Opt out of the fixed Grade 1–12 ladder and build the school's own.
 *
 * While the switch is off nothing else on this page renders and the rest of the
 * system behaves exactly as before — that is the whole point of it being
 * opt-in. Turning it on only unlocks the tiers; no existing class is touched.
 */
export default function AcademicStructureSettingsPage() {
  const t = useT();
  const academics = useAcademicsState();
  const [settings, setSettings] = useState<AcademicStructureSettings | null>(null);
  const [years, setYears] = useState<{ id: string; name: string; isActive: boolean }[]>([]);
  const [yearId, setYearId] = useState("");
  const [cloneFrom, setCloneFrom] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const [s, y] = await Promise.all([apiGetStructureSettings(), apiListYears()]);
        setSettings(s);
        setYears(y);
        setYearId((y.find((x) => x.isActive) ?? y[0])?.id ?? "");
      } catch (e) {
        toast(e instanceof Error ? e.message : "Could not load settings", "error");
      } finally {
        setLoading(false);
      }
    })();
    // academics is read so the page refreshes when the year list changes
  }, [academics]);

  async function patch(next: Partial<AcademicStructureSettings>) {
    setSaving(true);
    try {
      setSettings(await apiUpdateStructureSettings(next));
      toast(t("settingsAcademicStructure.saved"), "success");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Update failed", "error");
    } finally {
      setSaving(false);
    }
  }

  if (loading || !settings) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">
          {t("settingsAcademicStructure.title")}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsAcademicStructure.subtitle")}
        </p>
      </div>

      <SettingsToggle
        label={t("settingsAcademicStructure.enable")}
        description={t("settingsAcademicStructure.enableHint")}
        checked={settings.customStructureEnabled}
        onChange={(v) => void patch({ customStructureEnabled: v })}
      />

      {settings.customStructureEnabled && (
        <>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="rounded-xl border bg-card p-4">
              <span className="font-medium">
                {t("settingsAcademicStructure.termsPerYear")}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t("settingsAcademicStructure.termsPerYearHint")}
              </span>
              <input
                type="number"
                min={1}
                max={6}
                disabled={saving}
                value={settings.termsPerYear}
                onChange={(e) => {
                  const n = Number(e.target.value);
                  if (n >= 1 && n <= 6) void patch({ termsPerYear: n });
                }}
                className="mt-3 h-9 w-24 rounded-lg border bg-background px-3"
              />
            </label>

            <label className="rounded-xl border bg-card p-4">
              <span className="font-medium">
                {t("settingsAcademicStructure.repeatScope")}
              </span>
              <span className="mt-0.5 block text-sm text-muted-foreground">
                {t("settingsAcademicStructure.repeatScopeHint")}
              </span>
              <select
                disabled={saving}
                value={settings.repeatScope}
                onChange={(e) =>
                  void patch({
                    repeatScope: e.target.value as "CLASS" | "STAGE",
                  })
                }
                className="mt-3 h-9 rounded-lg border bg-background px-3"
              >
                <option value="CLASS">
                  {t("settingsAcademicStructure.repeatClass")}
                </option>
                <option value="STAGE">
                  {t("settingsAcademicStructure.repeatStage")}
                </option>
              </select>
            </label>
          </div>

          <SettingsToggle
            label={t("settingsAcademicStructure.hideDefaultGrades")}
            description={t("settingsAcademicStructure.hideDefaultGradesHint")}
            checked={settings.hideDefaultGrades}
            onChange={(v) => void patch({ hideDefaultGrades: v })}
          />

          <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-medium">
                  {t("settingsAcademicStructure.ladder")}
                </p>
                <p className="mt-0.5 text-sm text-muted-foreground">
                  {t("settingsAcademicStructure.ladderHint")}
                </p>
              </div>
              <select
                value={yearId}
                onChange={(e) => setYearId(e.target.value)}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              >
                {years.map((y) => (
                  <option key={y.id} value={y.id}>
                    {y.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="mt-4">
              {yearId && (
                <AcademicStructureBuilder
                  academicYearId={yearId}
                  hideDefaultGrades={settings.hideDefaultGrades}
                />
              )}
            </div>
          </div>

          {/* Define the ladder once, then copy it forward each year. */}
          <div className="rounded-xl border bg-card p-4">
            <p className="font-medium">
              {t("settingsAcademicStructure.copyTitle")}
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("settingsAcademicStructure.copyHint")}
            </p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <select
                value={cloneFrom}
                onChange={(e) => setCloneFrom(e.target.value)}
                className="h-9 rounded-lg border bg-background px-3 text-sm"
              >
                <option value="">
                  {t("settingsAcademicStructure.copyFrom")}
                </option>
                {years
                  .filter((y) => y.id !== yearId)
                  .map((y) => (
                    <option key={y.id} value={y.id}>
                      {y.name}
                    </option>
                  ))}
              </select>
              <Button
                variant="outline"
                disabled={!cloneFrom || saving}
                onClick={() => {
                  setSaving(true);
                  void apiCloneStructure({
                    fromAcademicYearId: cloneFrom,
                    toAcademicYearId: yearId,
                  })
                    .then((r) =>
                      toast(
                        t("settingsAcademicStructure.copied", {
                          levels: r.levels,
                          classes: r.classes,
                        }),
                        "success",
                      ),
                    )
                    .catch((e: unknown) =>
                      toast(
                        e instanceof Error ? e.message : "Copy failed",
                        "error",
                      ),
                    )
                    .finally(() => setSaving(false));
                }}
              >
                <Copy className="me-1 h-4 w-4" />
                {t("settingsAcademicStructure.copyInto")}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
