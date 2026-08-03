"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PromptDialog } from "@/components/ui/prompt-dialog";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { toast } from "@/lib/toast";
import type { EntityStatus } from "@/lib/academics/types";

interface NamedItem {
  id: string;
  name: string;
  orderIndex: number;
  status: EntityStatus;
}

/**
 * A reorderable, add/rename/delete list of school-defined names — the exact
 * UI Villages and Districts both need (and any future list like them), so it
 * lives once here instead of being copy-pasted per list.
 */
export function NamedListManager<T extends NamedItem>({
  title,
  subtitle,
  namePlaceholder,
  addLabel,
  addFailedMessage,
  renameFailedMessage,
  reorderFailedMessage,
  deleteFailedMessage,
  deleteConfirmMessage,
  emptyMessage,
  list,
  create,
  update,
  remove,
  onChanged,
}: {
  title: string;
  subtitle: string;
  namePlaceholder: string;
  addLabel: string;
  addFailedMessage: string;
  renameFailedMessage: string;
  reorderFailedMessage: string;
  deleteFailedMessage: string;
  deleteConfirmMessage: string;
  emptyMessage: string;
  list: (includeInactive?: boolean) => Promise<T[]>;
  create: (body: { name: string; orderIndex?: number }) => Promise<T>;
  update: (
    id: string,
    body: { name?: string; orderIndex?: number; status?: EntityStatus },
  ) => Promise<T>;
  remove: (id: string) => Promise<{ success: boolean }>;
  /** Called after any successful mutation, so a caller's own cache (the
   *  student-form dropdown) can be told to refresh too. */
  onChanged?: () => void | Promise<void>;
}) {
  const t = useT();
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState("");
  const [renaming, setRenaming] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  async function load() {
    setLoading(true);
    try {
      setItems(await list());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load list", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function run(fallback: string, fn: () => Promise<unknown>) {
    setBusy(true);
    try {
      await fn();
      await load();
      await onChanged?.();
    } catch (e) {
      toast(e instanceof Error ? e.message : fallback, "error");
    } finally {
      setBusy(false);
    }
  }

  function move(index: number, delta: number) {
    const next = [...items];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target]!, next[index]!];
    void run(reorderFailedMessage, () =>
      Promise.all(next.map((v, i) => update(v.id, { orderIndex: i }))),
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{subtitle}</p>
      </div>

      <div className="rounded-xl border bg-card p-4">
        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={namePlaceholder}
            className="h-9 max-w-xs"
            onKeyDown={(e) => {
              if (e.key === "Enter" && newName.trim()) {
                const name = newName.trim();
                setNewName("");
                void run(addFailedMessage, () => create({ name }));
              }
            }}
          />
          <Button
            disabled={busy || !newName.trim()}
            onClick={() => {
              const name = newName.trim();
              setNewName("");
              void run(addFailedMessage, () => create({ name }));
            }}
          >
            <Plus className="me-1 h-4 w-4" />
            {addLabel}
          </Button>
        </div>

        {loading ? (
          <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> {t("common.loading")}
          </p>
        ) : items.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </p>
        ) : (
          <ul className="mt-4 space-y-2">
            {items.map((v, i) => (
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
                    disabled={i === items.length - 1 || busy}
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
            void run(renameFailedMessage, () => update(v.id, { name }));
          }
        }}
        onClose={() => setRenaming(null)}
      />
      <ConfirmDialog
        open={!!deleting}
        title={t("common.delete")}
        message={deleteConfirmMessage}
        onConfirm={() => {
          const v = deleting;
          setDeleting(null);
          if (v) void run(deleteFailedMessage, () => remove(v.id));
        }}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
