"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Layers,
  Loader2,
  Pencil,
  Plus,
  Trash2,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { apiCreateClass, apiDeleteClass, apiUpdateClass } from "@/lib/academics/api";
import {
  apiCreateLevel,
  apiCreateStage,
  apiDeleteLevel,
  apiDeleteStage,
  apiReorder,
  apiStructureTree,
  apiUpdateLevel,
  apiUpdateStage,
  type StructureTree,
} from "@/lib/academics/structure-api";

/**
 * The Level → Stage → Class ladder a school builds for itself.
 *
 * Order is the point, not decoration: promotion walks classes by orderIndex,
 * so the arrows here are what decide where a student goes next. Both grouping
 * tiers are optional — a class can hang straight off a level, the way an
 * Arabic school usually leaves its earliest classes ungrouped.
 */
export function AcademicStructureBuilder({
  academicYearId,
}: {
  academicYearId: string;
}) {
  const t = useT();
  const [tree, setTree] = useState<StructureTree | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newLevel, setNewLevel] = useState("");
  const [addingTo, setAddingTo] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTree(await apiStructureTree(academicYearId));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load structure", "error");
    } finally {
      setLoading(false);
    }
  }, [academicYearId]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Every mutation reloads: the tree is small and the order must stay honest. */
  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : label, "error");
    } finally {
      setBusy(false);
    }
  }

  function move<T extends { id: string }>(
    items: T[],
    index: number,
    delta: number,
    entity: "level" | "stage" | "class",
  ) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run("Reorder failed", () =>
      apiReorder(entity, next.map((i) => i.id)),
    );
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
      </p>
    );
  }
  if (!tree) return null;

  const arrows = (
    onUp: () => void,
    onDown: () => void,
    first: boolean,
    last: boolean,
  ) => (
    <span className="flex shrink-0 items-center">
      <button
        type="button"
        disabled={first || busy}
        onClick={onUp}
        aria-label={t("settingsAcademicStructure.moveUp")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <ChevronUp className="h-4 w-4" />
      </button>
      <button
        type="button"
        disabled={last || busy}
        onClick={onDown}
        aria-label={t("settingsAcademicStructure.moveDown")}
        className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
      >
        <ChevronDown className="h-4 w-4" />
      </button>
    </span>
  );

  async function rename(
    current: string,
    save: (name: string) => Promise<unknown>,
  ) {
    const name = window.prompt(t("settingsAcademicStructure.newName"), current);
    if (!name || name.trim() === current) return;
    await run("Rename failed", () => save(name.trim()));
  }

  const classRow = (
    cls: { id: string; name: string },
    siblings: { id: string }[],
    index: number,
  ) => (
    <li
      key={cls.id}
      className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
    >
      {arrows(
        () => move(siblings, index, -1, "class"),
        () => move(siblings, index, 1, "class"),
        index === 0,
        index === siblings.length - 1,
      )}
      <span className="min-w-0 flex-1 truncate text-sm">{cls.name}</span>
      <button
        type="button"
        disabled={busy}
        onClick={() =>
          rename(cls.name, (name) => apiUpdateClass(cls.id, { name }))
        }
        aria-label={t("common.edit")}
        className="rounded p-1 text-muted-foreground hover:bg-muted"
      >
        <Pencil className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          if (!window.confirm(t("settingsAcademicStructure.deleteClassConfirm")))
            return;
          void run("Delete failed", () => apiDeleteClass(cls.id));
        }}
        aria-label={t("common.delete")}
        className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </li>
  );

  /** Inline "add" box, reused for a level's own classes and a stage's. */
  const addBox = (key: string, onAdd: (name: string) => Promise<unknown>) =>
    addingTo === key ? (
      <li className="flex items-center gap-2">
        <Input
          autoFocus
          value={draftName}
          onChange={(e) => setDraftName(e.target.value)}
          placeholder={t("settingsAcademicStructure.className")}
          className="h-9"
          onKeyDown={(e) => {
            if (e.key === "Escape") setAddingTo(null);
            if (e.key === "Enter" && draftName.trim()) {
              const name = draftName.trim();
              setDraftName("");
              setAddingTo(null);
              void run("Create failed", () => onAdd(name));
            }
          }}
        />
        <Button
          disabled={busy || !draftName.trim()}
          onClick={() => {
            const name = draftName.trim();
            setDraftName("");
            setAddingTo(null);
            void run("Create failed", () => onAdd(name));
          }}
        >
          {t("common.add")}
        </Button>
        <Button variant="ghost" onClick={() => setAddingTo(null)}>
          {t("common.cancel")}
        </Button>
      </li>
    ) : (
      <li>
        <button
          type="button"
          disabled={busy}
          onClick={() => {
            setDraftName("");
            setAddingTo(key);
          }}
          className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3 w-3" /> {t("settingsAcademicStructure.addClass")}
        </button>
      </li>
    );

  return (
    <div className="space-y-4">
      {/* ── Add a level ── */}
      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={newLevel}
          onChange={(e) => setNewLevel(e.target.value)}
          placeholder={t("settingsAcademicStructure.levelNamePlaceholder")}
          className="h-9 max-w-xs"
        />
        <Button
          disabled={busy || !newLevel.trim()}
          onClick={() => {
            const name = newLevel.trim();
            setNewLevel("");
            void run("Create failed", () =>
              apiCreateLevel({ academicYearId, name }),
            );
          }}
        >
          <Plus className="me-1 h-4 w-4" />
          {t("settingsAcademicStructure.addLevel")}
        </Button>
      </div>

      {tree.levels.length === 0 && (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {t("settingsAcademicStructure.noLevelsYet")}
        </p>
      )}

      {tree.levels.map((level, li) => (
        <div key={level.id} className="rounded-xl border bg-card p-4">
          <div className="flex items-center gap-2">
            {arrows(
              () => move(tree.levels, li, -1, "level"),
              () => move(tree.levels, li, 1, "level"),
              li === 0,
              li === tree.levels.length - 1,
            )}
            <Layers className="h-4 w-4 shrink-0 text-primary" />
            <span className="min-w-0 flex-1 truncate font-semibold">
              {level.name}
            </span>
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                rename(level.name, (name) => apiUpdateLevel(level.id, { name }))
              }
              aria-label={t("common.edit")}
              className="rounded p-1 text-muted-foreground hover:bg-muted"
            >
              <Pencil className="h-4 w-4" />
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (!window.confirm(t("settingsAcademicStructure.deleteLevelConfirm")))
                  return;
                void run("Delete failed", () => apiDeleteLevel(level.id));
              }}
              aria-label={t("common.delete")}
              className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>

          {/* Classes hung straight off the level. */}
          <ul className="ms-6 mt-3 space-y-2">
            {level.classes.map((c, ci) => classRow(c, level.classes, ci))}
            {addBox(`level:${level.id}`, (name) =>
              apiCreateClass({
                academicYearId,
                name,
                levelId: level.id,
              } as Parameters<typeof apiCreateClass>[0]),
            )}
          </ul>

          {/* Stages, each holding the classes of one year. */}
          {level.stages.map((stage, si) => (
            <div key={stage.id} className="ms-6 mt-3 rounded-lg border bg-muted/30 p-3">
              <div className="flex items-center gap-2">
                {arrows(
                  () => move(level.stages, si, -1, "stage"),
                  () => move(level.stages, si, 1, "stage"),
                  si === 0,
                  si === level.stages.length - 1,
                )}
                <span className="min-w-0 flex-1 truncate text-sm font-medium">
                  {stage.name}
                </span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    rename(stage.name, (name) => apiUpdateStage(stage.id, { name }))
                  }
                  aria-label={t("common.edit")}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    if (!window.confirm(t("settingsAcademicStructure.deleteStageConfirm")))
                      return;
                    void run("Delete failed", () => apiDeleteStage(stage.id));
                  }}
                  aria-label={t("common.delete")}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
              <ul className="ms-6 mt-2 space-y-2">
                {stage.classes.map((c, ci) => classRow(c, stage.classes, ci))}
                {addBox(`stage:${stage.id}`, (name) =>
                  apiCreateClass({
                    academicYearId,
                    name,
                    levelId: level.id,
                    stageId: stage.id,
                  } as Parameters<typeof apiCreateClass>[0]),
                )}
              </ul>
            </div>
          ))}

          <button
            type="button"
            disabled={busy}
            onClick={() => {
              const name = window.prompt(
                t("settingsAcademicStructure.stageNamePrompt"),
              );
              if (!name?.trim()) return;
              void run("Create failed", () =>
                apiCreateStage({ levelId: level.id, name: name.trim() }),
              );
            }}
            className="ms-6 mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <Plus className="h-3 w-3" /> {t("settingsAcademicStructure.addStage")}
          </button>
        </div>
      ))}

      {/* Classes that belong to no level — everything a default-ladder school has. */}
      {tree.ungrouped.length > 0 && (
        <div className={cn("rounded-xl border border-dashed p-4")}>
          <p className="text-sm font-medium">
            {t("settingsAcademicStructure.ungrouped")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {t("settingsAcademicStructure.ungroupedHint")}
          </p>
          <ul className="mt-3 space-y-2">
            {tree.ungrouped.map((c, ci) => (
              <li
                key={c.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
              >
                {arrows(
                  () => move(tree.ungrouped, ci, -1, "class"),
                  () => move(tree.ungrouped, ci, 1, "class"),
                  ci === 0,
                  ci === tree.ungrouped.length - 1,
                )}
                <span className="min-w-0 flex-1 truncate text-sm">{c.name}</span>
                {tree.levels.length > 0 && (
                  <select
                    disabled={busy}
                    defaultValue=""
                    onChange={(e) => {
                      const levelId = e.target.value;
                      if (!levelId) return;
                      void run("Update failed", () =>
                        apiUpdateClass(c.id, { levelId } as Parameters<
                          typeof apiUpdateClass
                        >[1]),
                      );
                    }}
                    className="h-8 rounded-lg border bg-background px-2 text-xs"
                  >
                    <option value="">
                      {t("settingsAcademicStructure.moveToLevel")}
                    </option>
                    {tree.levels.map((l) => (
                      <option key={l.id} value={l.id}>
                        {l.name}
                      </option>
                    ))}
                  </select>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
