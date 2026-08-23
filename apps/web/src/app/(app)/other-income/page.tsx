"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, Pencil, Plus, Trash2, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/students/confirm-dialog";
import { useT } from "@/lib/i18n/provider";
import { toast } from "@/lib/toast";
import {
  apiCreateIncomeCategory,
  apiCreateOtherIncome,
  apiDeleteOtherIncome,
  apiListIncomeCategories,
  apiListOtherIncome,
  apiOtherIncomeSummary,
  apiUpdateOtherIncome,
  type ApiIncomeCategory,
  type ApiOtherIncome,
  type OtherIncomeSummary,
} from "@/lib/other-income/api";

const money = (n: number) =>
  `$${n.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;

function thisMonth() {
  const d = new Date();
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** The last 12 months, newest first — enough to find any entry by hand. */
function monthOptions() {
  const out: { key: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 12; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    out.push({
      key,
      label: d.toLocaleString(undefined, {
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }),
    });
  }
  return out;
}

const EMPTY_FORM = {
  title: "",
  source: "",
  amount: "",
  categoryId: "",
  method: "",
  note: "",
  receivedAt: new Date().toISOString().slice(0, 10),
};

export default function OtherIncomePage() {
  const t = useT();
  const [mounted, setMounted] = useState(false);
  const [month, setMonth] = useState(thisMonth());
  const [categories, setCategories] = useState<ApiIncomeCategory[]>([]);
  const [rows, setRows] = useState<ApiOtherIncome[]>([]);
  const [summary, setSummary] = useState<OtherIncomeSummary | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<ApiOtherIncome | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<ApiOtherIncome | null>(null);
  const [newCategory, setNewCategory] = useState("");

  useEffect(() => setMounted(true), []);

  const load = useCallback(async () => {
    try {
      const [cats, list, sum] = await Promise.all([
        apiListIncomeCategories(),
        apiListOtherIncome(),
        apiOtherIncomeSummary(month),
      ]);
      setCategories(cats);
      setRows(list);
      setSummary(sum);
      setLoadFailed(false);
    } catch {
      // Never fall back to zeros — a confident $0 is worse than saying so.
      setLoadFailed(true);
    }
  }, [month]);

  useEffect(() => {
    if (!mounted) return;
    void load();
  }, [mounted, load]);

  const monthRows = useMemo(
    () => rows.filter((r) => r.receivedAt.slice(0, 7) === month),
    [rows, month],
  );

  function openCreate() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, receivedAt: new Date().toISOString().slice(0, 10) });
    setFormOpen(true);
  }

  function openEdit(row: ApiOtherIncome) {
    setEditing(row);
    setForm({
      title: row.title,
      source: row.source ?? "",
      amount: String(row.amount),
      categoryId: row.categoryId ?? "",
      method: row.method ?? "",
      note: row.note ?? "",
      receivedAt: row.receivedAt.slice(0, 10),
    });
    setFormOpen(true);
  }

  async function handleSave() {
    const amount = Number(form.amount);
    if (!form.title.trim()) return toast("Title is required", "error");
    if (!Number.isFinite(amount) || amount <= 0) {
      return toast("Enter an amount greater than zero", "error");
    }
    setSaving(true);
    try {
      const body = {
        title: form.title.trim(),
        source: form.source.trim() || null,
        amount,
        categoryId: form.categoryId || null,
        method: form.method.trim() || null,
        note: form.note.trim() || null,
        receivedAt: new Date(`${form.receivedAt}T00:00:00.000Z`).toISOString(),
      };
      if (editing) await apiUpdateOtherIncome(editing.id, body);
      else await apiCreateOtherIncome(body);
      await load();
      toast(editing ? "Income updated" : "Income recorded", "success");
      setFormOpen(false);
    } catch {
      toast("Could not save this income entry", "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!deleting) return;
    try {
      await apiDeleteOtherIncome(deleting.id);
      await load();
      toast("Income entry deleted", "success");
      setDeleting(null);
    } catch {
      toast("Could not delete this entry", "error");
    }
  }

  async function handleAddCategory() {
    const name = newCategory.trim();
    if (!name) return;
    try {
      await apiCreateIncomeCategory(name);
      setNewCategory("");
      await load();
      toast("Category added", "success");
    } catch {
      toast("Could not add that category", "error");
    }
  }

  if (!mounted) {
    return (
      <div className="flex h-64 items-center justify-center text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">Additional Income</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Money the school receives outside student fees — and where it came from.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-2 rounded-lg border bg-card px-3 py-2 text-sm">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select
              value={month}
              onChange={(e) => setMonth(e.target.value)}
              className="border-0 bg-transparent p-0 focus:ring-0"
            >
              {monthOptions().map((m) => (
                <option key={m.key} value={m.key}>
                  {m.label}
                </option>
              ))}
            </Select>
          </span>
          <Button onClick={openCreate}>
            <Plus className="me-2 h-4 w-4" />
            Record Income
          </Button>
        </div>
      </div>

      {loadFailed && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-700 dark:text-amber-400">
          Could not load additional income. The figures below are not shown
          rather than shown wrong — check your connection and reload.
        </div>
      )}

      {!loadFailed && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-600">
              <TrendingUp className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">
              Additional Income (This Month)
            </p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">
              {money(summary?.total ?? 0)}
            </p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/10 text-blue-600">
              <Wallet className="h-5 w-5" />
            </span>
            <p className="mt-3 text-sm text-muted-foreground">Entries</p>
            <p className="mt-1 text-2xl font-bold">{summary?.count ?? 0}</p>
          </div>
          <div className="rounded-xl border bg-card p-5 shadow-sm">
            <p className="text-sm font-semibold">Where it came from</p>
            {(summary?.bySource.length ?? 0) === 0 ? (
              <p className="mt-2 text-sm text-muted-foreground">
                Nothing recorded this month.
              </p>
            ) : (
              <dl className="mt-3 space-y-2">
                {summary?.bySource.map((s) => (
                  <div key={s.name} className="flex justify-between text-sm">
                    <dt className="text-muted-foreground">{s.name}</dt>
                    <dd className="font-semibold tabular-nums">{money(s.amount)}</dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>
      )}

      <div className="rounded-xl border bg-card shadow-sm">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <h2 className="font-semibold">Income this month</h2>
          <span className="text-sm text-muted-foreground">
            {monthRows.length} {monthRows.length === 1 ? "entry" : "entries"}
          </span>
        </div>
        {monthRows.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted-foreground">
            No additional income recorded for this month yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-start">
                <tr>
                  <th className="px-5 py-3 text-start font-medium">Title</th>
                  <th className="px-5 py-3 text-start font-medium">Source</th>
                  <th className="px-5 py-3 text-start font-medium">Category</th>
                  <th className="px-5 py-3 text-start font-medium">Date</th>
                  <th className="px-5 py-3 text-end font-medium">Amount</th>
                  <th className="px-5 py-3 text-end font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {monthRows.map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="px-5 py-3 font-medium">{r.title}</td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.source ?? "—"}
                    </td>
                    <td className="px-5 py-3">
                      {r.category ? (
                        <Badge tone="muted">{r.category.name}</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-muted-foreground">
                      {r.receivedAt.slice(0, 10)}
                    </td>
                    <td className="px-5 py-3 text-end font-semibold tabular-nums text-emerald-600">
                      {money(r.amount)}
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={() => openEdit(r)}
                          aria-label="Edit"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={() => setDeleting(r)}
                          aria-label="Delete"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-sm">
        <h2 className="font-semibold">Income categories</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Used to group income so the summary can show where the money came from.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {categories.map((c) => (
            <Badge key={c.id} tone="muted">
              {c.name}
            </Badge>
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <Input
            value={newCategory}
            onChange={(e) => setNewCategory(e.target.value)}
            placeholder="New category (e.g. Library fines)"
            className="max-w-xs"
          />
          <Button variant="outline" onClick={() => void handleAddCategory()}>
            Add
          </Button>
        </div>
      </div>

      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={editing ? "Edit Income" : "Record Income"}
        description="Anything the school received that is not a student fee."
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={() => void handleSave()} disabled={saving}>
              {saving ? "Saving…" : editing ? "Save Changes" : "Record Income"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="oi-title">Title</Label>
            <Input
              id="oi-title"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              placeholder="e.g. Hall rent for August"
            />
          </div>
          <div>
            <Label htmlFor="oi-source">Where did it come from?</Label>
            <Input
              id="oi-source"
              value={form.source}
              onChange={(e) => setForm({ ...form, source: e.target.value })}
              placeholder="e.g. Cabdi Nuur, Hormuud, community fund"
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="oi-amount">Amount</Label>
              <Input
                id="oi-amount"
                type="number"
                min={1}
                value={form.amount}
                onChange={(e) => setForm({ ...form, amount: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="oi-date">Date received</Label>
              <Input
                id="oi-date"
                type="date"
                value={form.receivedAt}
                onChange={(e) => setForm({ ...form, receivedAt: e.target.value })}
              />
            </div>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="oi-category">Category</Label>
              <Select
                id="oi-category"
                value={form.categoryId}
                onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
              >
                <option value="">— None —</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="oi-method">Method</Label>
              <Input
                id="oi-method"
                value={form.method}
                onChange={(e) => setForm({ ...form, method: e.target.value })}
                placeholder="Cash, EVC, bank…"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="oi-note">Note</Label>
            <Textarea
              id="oi-note"
              rows={3}
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
            />
          </div>
        </div>
      </Dialog>

      <ConfirmDialog
        open={!!deleting}
        title="Delete income entry"
        message={
          deleting
            ? `Delete "${deleting.title}" (${money(deleting.amount)})? This removes it from the finance summary.`
            : ""
        }
        onConfirm={() => void handleDelete()}
        onClose={() => setDeleting(null)}
      />
    </div>
  );
}
