"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Plus,
  Receipt,
  Send,
  Trash2,
  Users,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/ui/dialog";
import {
  apiApplyExtraFee,
  apiCreateExtraFee,
  apiDeleteExtraFee,
  apiListExtraFees,
  apiPreviewExtraFee,
  apiUpdateExtraFee,
  type ApiExtraFee,
  type ExtraFeePreview,
} from "@/lib/fees/api";
import { refreshFees } from "@/lib/fees/store";
import {
  activeAcademicYear,
  ensureAcademicsLoaded,
  useAcademicsState,
} from "@/lib/academics/store";
import { toast } from "@/lib/toast";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const money = (n: number) => `$${n.toLocaleString()}`;

interface FormState {
  id: string | null;
  name: string;
  description: string;
  year: number;
  month: number;
  appliesToAllClasses: boolean;
  defaultAmount: string;
  classAmounts: Record<string, string>;
}

function emptyForm(): FormState {
  const now = new Date();
  return {
    id: null,
    name: "",
    description: "",
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    appliesToAllClasses: true,
    defaultAmount: "",
    classAmounts: {},
  };
}

export default function ExtraFeesPage() {
  const academics = useAcademicsState();
  const year = activeAcademicYear();

  const [fees, setFees] = useState<ApiExtraFee[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const [previewFor, setPreviewFor] = useState<ApiExtraFee | null>(null);
  const [preview, setPreview] = useState<ExtraFeePreview | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [applying, setApplying] = useState(false);

  const classes = useMemo(
    () => academics.classes.filter((c) => !year || c.academicYear === year),
    [academics.classes, year],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setFees(await apiListExtraFees());
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load extra fees", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void ensureAcademicsLoaded();
    void load();
  }, [load]);

  function openCreate() {
    setForm(emptyForm());
    setFormOpen(true);
  }

  function openEdit(f: ApiExtraFee) {
    setForm({
      id: f.id,
      name: f.name,
      description: f.description ?? "",
      year: f.year,
      month: f.month,
      appliesToAllClasses: f.appliesToAllClasses,
      defaultAmount: f.defaultAmount != null ? String(f.defaultAmount) : "",
      classAmounts: Object.fromEntries(
        f.classAmounts.map((c) => [c.classId, String(c.amount)]),
      ),
    });
    setFormOpen(true);
  }

  async function save() {
    if (!form.name.trim()) return toast("Enter a name for this fee", "error");

    const classAmounts = Object.entries(form.classAmounts)
      .filter(([, v]) => v.trim() !== "" && Number(v) > 0)
      .map(([classId, v]) => ({ classId, amount: Number(v) }));

    if (form.appliesToAllClasses) {
      if (!form.defaultAmount.trim() || Number(form.defaultAmount) <= 0) {
        return toast("Enter the amount to charge every class", "error");
      }
    } else if (classAmounts.length === 0) {
      return toast("Set an amount for at least one class", "error");
    }

    const body = {
      name: form.name.trim(),
      description: form.description.trim() || null,
      year: form.year,
      month: form.month,
      appliesToAllClasses: form.appliesToAllClasses,
      defaultAmount: form.appliesToAllClasses ? Number(form.defaultAmount) : null,
      classAmounts: form.appliesToAllClasses ? [] : classAmounts,
    };

    setSaving(true);
    try {
      if (form.id) await apiUpdateExtraFee(form.id, body);
      else await apiCreateExtraFee(body);
      toast(form.id ? "Extra fee updated" : "Extra fee created", "success");
      setFormOpen(false);
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Save failed", "error");
    } finally {
      setSaving(false);
    }
  }

  async function remove(f: ApiExtraFee) {
    const warning = f.appliedCount
      ? `"${f.name}" has already been billed to ${f.appliedCount} student(s). Deleting it removes those unpaid charges. Continue?`
      : `Delete "${f.name}"?`;
    if (!confirm(warning)) return;
    try {
      await apiDeleteExtraFee(f.id);
      toast("Extra fee deleted", "success");
      await load();
      await refreshFees();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Delete failed", "error");
    }
  }

  async function openPreview(f: ApiExtraFee) {
    setPreviewFor(f);
    setPreview(null);
    setPreviewLoading(true);
    try {
      setPreview(await apiPreviewExtraFee(f.id));
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not load preview", "error");
      setPreviewFor(null);
    } finally {
      setPreviewLoading(false);
    }
  }

  async function apply() {
    if (!previewFor) return;
    setApplying(true);
    try {
      const res = await apiApplyExtraFee(previewFor.id);
      toast(
        res.applied > 0
          ? `Charged ${res.applied} student(s) — ${money(res.totalAmount)} added`
          : "Every matching student already had this fee",
        "success",
      );
      setPreviewFor(null);
      await load();
      // The ledger/history views read from the fees store, so pull the new
      // charges in rather than leaving a stale cache behind.
      await refreshFees();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Could not apply the fee", "error");
    } finally {
      setApplying(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Receipt className="h-6 w-6 text-primary" />
            Extra Fees
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            One-off charges such as an exam fee. They are added on top of the
            student&apos;s regular fee for the month you choose.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> New extra fee
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center gap-2 py-16 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : fees.length === 0 ? (
        <div className="rounded-2xl border bg-card py-16 text-center text-muted-foreground">
          <Receipt className="mx-auto mb-2 h-8 w-8 opacity-40" />
          <p>No extra fees yet.</p>
          <p className="mt-1 text-sm">
            Create one to charge something like an exam fee alongside the monthly fee.
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {fees.map((f) => (
            <div key={f.id} className="rounded-2xl border bg-card p-5 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-semibold">{f.name}</h2>
                    {f.appliedAt ? (
                      <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-700 dark:text-emerald-300">
                        <CheckCircle2 className="h-3 w-3" /> Applied
                      </span>
                    ) : (
                      <span className="rounded bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-300">
                        Not applied yet
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {MONTHS[f.month - 1]} {f.year}
                    {" · "}
                    {f.appliesToAllClasses
                      ? `All classes · ${money(f.defaultAmount ?? 0)}`
                      : `${f.classAmounts.length} class(es)`}
                  </p>
                  {f.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{f.description}</p>
                  )}
                  {!f.appliesToAllClasses && f.classAmounts.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {f.classAmounts.map((c) => (
                        <span
                          key={c.id}
                          className="rounded bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground"
                        >
                          {c.class.name}: {money(c.amount)}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <Button
                    variant="outline"
                    className="h-8 px-3 text-xs"
                    onClick={() => void openPreview(f)}
                  >
                    <Send className="mr-1.5 h-3.5 w-3.5" />
                    {f.appliedAt ? "Apply again" : "Review & apply"}
                  </Button>
                  {!f.appliedAt && (
                    <Button
                      variant="outline"
                      className="h-8 px-3 text-xs"
                      onClick={() => openEdit(f)}
                    >
                      Edit
                    </Button>
                  )}
                  <button
                    type="button"
                    onClick={() => void remove(f)}
                    className="rounded-md p-1.5 text-muted-foreground hover:bg-rose-100 hover:text-rose-600"
                    aria-label="Delete"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {f.appliedCount > 0 && (
                <div className="mt-3 flex flex-wrap gap-4 border-t pt-3 text-xs text-muted-foreground">
                  <span>
                    <strong className="text-foreground">{f.appliedCount}</strong> student(s) charged
                  </span>
                  <span>
                    Billed <strong className="text-foreground">{money(f.appliedTotal)}</strong>
                  </span>
                  <span>
                    Collected{" "}
                    <strong className="text-emerald-600 dark:text-emerald-400">
                      {money(f.collectedTotal)}
                    </strong>
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* ── Create / edit ── */}
      <Dialog
        open={formOpen}
        onClose={() => setFormOpen(false)}
        title={form.id ? "Edit extra fee" : "New extra fee"}
        description="Charged on top of the regular monthly fee for the month you pick."
        className="sm:max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setFormOpen(false)}>
              <X className="mr-1.5 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={() => void save()} disabled={saving}>
              {saving ? "Saving…" : form.id ? "Save changes" : "Create"}
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          <div>
            <Label htmlFor="ef-name">Fee name</Label>
            <Input
              id="ef-name"
              className="mt-1.5"
              placeholder="e.g. Exam Fee"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
            <p className="mt-1 text-xs text-muted-foreground">
              This is what the parent sees on the invoice and payment history.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="ef-month">Charge in month</Label>
              <Select
                id="ef-month"
                className="mt-1.5"
                value={String(form.month)}
                onChange={(e) =>
                  setForm((f) => ({ ...f, month: Number(e.target.value) }))
                }
              >
                {MONTHS.map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="ef-year">Year</Label>
              <Input
                id="ef-year"
                type="number"
                className="mt-1.5"
                value={form.year}
                onChange={(e) =>
                  setForm((f) => ({ ...f, year: Number(e.target.value) }))
                }
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ef-desc">Description (optional)</Label>
            <Textarea
              id="ef-desc"
              className="mt-1.5 min-h-[70px]"
              value={form.description}
              onChange={(e) =>
                setForm((f) => ({ ...f, description: e.target.value }))
              }
            />
          </div>

          <div className="rounded-xl border bg-secondary/30 p-4">
            <Label>Who pays it</Label>
            <div className="mt-2 space-y-2">
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={form.appliesToAllClasses}
                  onChange={() =>
                    setForm((f) => ({ ...f, appliesToAllClasses: true }))
                  }
                />
                <span>
                  Every class — same amount
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    One price charged to every active student in the school.
                  </span>
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm">
                <input
                  type="radio"
                  className="mt-1"
                  checked={!form.appliesToAllClasses}
                  onChange={() =>
                    setForm((f) => ({ ...f, appliesToAllClasses: false }))
                  }
                />
                <span>
                  Chosen classes — own amount each
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    Only classes you give an amount to are charged.
                  </span>
                </span>
              </label>
            </div>

            {form.appliesToAllClasses ? (
              <div className="mt-3">
                <Label htmlFor="ef-amount">Amount per student</Label>
                <Input
                  id="ef-amount"
                  type="number"
                  min={0}
                  className="mt-1.5"
                  placeholder="e.g. 10"
                  value={form.defaultAmount}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, defaultAmount: e.target.value }))
                  }
                />
              </div>
            ) : (
              <div className="mt-3 space-y-2">
                {classes.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No classes found for the active academic year.
                  </p>
                ) : (
                  <div className="max-h-56 space-y-1.5 overflow-auto rounded-lg border bg-background p-2">
                    {classes.map((c) => (
                      <div key={c.id} className="flex items-center gap-2">
                        <span className="flex-1 truncate text-sm">{c.name}</span>
                        <Input
                          type="number"
                          min={0}
                          className="h-8 w-28"
                          placeholder="—"
                          value={form.classAmounts[c.id] ?? ""}
                          onChange={(e) =>
                            setForm((f) => ({
                              ...f,
                              classAmounts: {
                                ...f.classAmounts,
                                [c.id]: e.target.value,
                              },
                            }))
                          }
                        />
                      </div>
                    ))}
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  Leave a class blank to skip it.
                </p>
              </div>
            )}
          </div>
        </div>
      </Dialog>

      {/* ── Preview & apply ── */}
      <Dialog
        open={!!previewFor}
        onClose={() => setPreviewFor(null)}
        title={previewFor ? `Apply "${previewFor.name}"` : ""}
        description={
          previewFor
            ? `Adds this charge to ${MONTHS[previewFor.month - 1]} ${previewFor.year}, on top of each student's regular fee.`
            : ""
        }
        className="sm:max-w-2xl"
        footer={
          <>
            <Button variant="outline" onClick={() => setPreviewFor(null)}>
              Cancel
            </Button>
            <Button
              onClick={() => void apply()}
              disabled={applying || previewLoading || !preview?.pendingCount}
            >
              {applying
                ? "Applying…"
                : `Charge ${preview?.pendingCount ?? 0} student(s)`}
            </Button>
          </>
        }
      >
        {previewLoading ? (
          <div className="flex items-center gap-2 py-10 text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Working out who pays…
          </div>
        ) : preview ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Students matched</p>
                <p className="mt-0.5 text-xl font-bold">{preview.studentCount}</p>
              </div>
              <div className="rounded-xl border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">To be charged</p>
                <p className="mt-0.5 text-xl font-bold">{preview.pendingCount}</p>
              </div>
              <div className="rounded-xl border bg-secondary/40 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Total added</p>
                <p className="mt-0.5 text-xl font-bold">{money(preview.totalAmount)}</p>
              </div>
            </div>

            {preview.pendingCount === 0 && preview.studentCount > 0 && (
              <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                Every matching student already has this fee — applying again adds nothing.
              </div>
            )}

            <div className="max-h-64 overflow-auto rounded-lg border">
              {preview.targets.length === 0 ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  <Users className="mx-auto mb-2 h-6 w-6 opacity-40" />
                  No active students matched this fee.
                </div>
              ) : (
                <ul className="divide-y text-sm">
                  {preview.targets.map((t) => (
                    <li
                      key={t.studentId}
                      className={`flex items-center gap-3 px-3 py-2 ${
                        t.alreadyCharged ? "opacity-50" : ""
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">{t.fullName}</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">
                          {t.code} · {t.className}
                        </p>
                      </div>
                      {t.alreadyCharged && (
                        <span className="shrink-0 text-[11px] text-muted-foreground">
                          already charged
                        </span>
                      )}
                      <span className="shrink-0 font-semibold">{money(t.amount)}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </Dialog>
    </div>
  );
}
