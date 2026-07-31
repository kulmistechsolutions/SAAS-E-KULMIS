"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { toast } from "@/lib/toast";
import {
  apiCreateVillage,
  apiDeleteVillage,
  apiListVillages,
  apiUpdateVillage,
  type ApiVillage,
} from "@/lib/villages/api";
import { refreshVillages } from "@/lib/villages/store";

/**
 * A school's own neighborhood list, offered as an optional field on student
 * registration. General-purpose — every school gets this page, independent
 * of whether it uses a custom academic structure.
 */
export default function VillagesSettingsPage() {
  const t = useT();
  const [villages, setVillages] = useState<ApiVillage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<ApiVillage | null>(null);
  const [deleting, setDeleting] = useState<ApiVillage | null>(null);

  async function load() {
    setLoading(true);
    try {
      setVillages(await apiListVillages());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load villages", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  async function run(fallback: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
      await refreshVillages(); // keep the student-form cache in sync
    } catch (e) {
      toast(e instanceof Error ? e.message : fallback, "error");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const next = [...villages];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(t("settingsVillages.reorderFailed"), () =>
      Promise.all(next.map((v, i) => apiUpdateVillage(v.id, { orderIndex: i }))),
    );
  }


  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{t("settingsVillages.title")}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("settingsVillages.subtitle")}
        </p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={t("settingsVillages.namePlaceholder")}
            className="h-9 max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                const name = newName.trim();
                setNewName("");
                void run(t("settingsVillages.addFailed"), () =>
                  apiCreateVillage({ name }),
                );
              }
            }}
          />
          <Button
            disabled={busy || !newName.trim()}
            onClick={() => {
              const name = newName.trim();
              setNewName("");
              void run(t("settingsVillages.addFailed"), () =>
                apiCreateVillage({ name }),
              );
            }}
          >
            <Plus className="me-1 h-4 w-4" />
            {t("settingsVillages.add")}
          </Button>
        </div>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </p>
        ) : villages.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {t("settingsVillages.noneYet")}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {villages.map((v, i) => (
              <li
                key={v.id}
                className="flex items-center gap-2 rounded-lg border bg-background px-3 py-2"
              >
                <span className="flex shrink-0 items-center">
                  <button
                    type="button"
                    disabled={i === 0 || busy}
                    onClick={() => move(i, -1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    disabled={i === villages.length - 1 || busy}
                    onClick={() => move(i, 1)}
                    className="rounded p-1 text-muted-foreground hover:bg-muted disabled:opacity-30"
                  >
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </span>
                <span className="min-w-0 flex-1 truncate text-sm">{v.name}</span>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setRenaming(v)}
                  className="rounded p-1 text-muted-foreground hover:bg-muted"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => setDeleting(v)}
                  className="rounded p-1 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <PromptDialog
        open={!!renaming}
        title={t("settingsVillages.newName")}
        initialValue={renaming?.name ?? ""}
        onSubmit={(name) => {
          const v = renaming;
          setRenaming(null);
          if (v && name !== v.name) {
            void run(t("settingsVillages.renameFailed"), () =>
              apiUpdateVillage(v.id, { name }),
            );
          }
        }}
        onClose={() => setRenaming(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t("common.delete")}
        message={t("settingsVillages.deleteConfirm")}
        onConfirm={() => {
          const v = deleting;
          setDeleting(null);
          if (v) void run(t("settingsVillages.deleteFailed"), () => apiDeleteVillage(v.id));
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
