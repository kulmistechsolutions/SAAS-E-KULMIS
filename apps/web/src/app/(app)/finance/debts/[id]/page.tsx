"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HandCoins, Printer, Trash2 } from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { money, shortDate } from "@/lib/students/format";
import { ApiError } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import {
  apiDeleteRepayment,
  apiGetDebt,
  apiRepayDebt,
  type CreateRepaymentInput,
} from "@/lib/debts/api";
import { printDebtStatement } from "@/lib/debts/print";
import { PaperPicker } from "@/components/print/paper-picker";
import { getStoredPaper, type PaperSize } from "@/lib/print/paper";
import type { SchoolDebtDetail } from "@/lib/debts/types";

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

export default function SchoolDebtDetailPage() {
  const t = useT();
  const { user } = useAuth();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [debt, setDebt] = useState<SchoolDebtDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [repayOpen, setRepayOpen] = useState(false);
  const [paper, setPaper] = useState<PaperSize>(() => getStoredPaper());

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const row = await apiGetDebt(id);
      setDebt(row);
    } catch (e) {
      toast(apiErr(e, t("schoolDebts.loadFailed")), "error");
    } finally {
      setLoading(false);
    }
  }, [id, t]);

  useEffect(() => {
    void load();
  }, [load]);

  async function removeRepayment(repaymentId: string) {
    try {
      await apiDeleteRepayment(repaymentId);
      toast(t("schoolDebts.repaymentRemoved"), "success");
      void load();
    } catch (e) {
      toast(apiErr(e, t("schoolDebts.saveFailed")), "error");
    }
  }

  if (loading) {
    return <p className="text-muted-foreground">{t("schoolDebts.loading")}</p>;
  }
  if (!debt) {
    return <p className="text-muted-foreground">{t("schoolDebts.notFound")}</p>;
  }

  return (
    <div className="space-y-6">
      <Link
        href="/finance/debts"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> {t("schoolDebts.back")}
      </Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <HandCoins className="h-6 w-6 text-primary" />
            {debt.lender}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {debt.purpose || t("schoolDebts.noPurpose")}
          </p>
        </div>
        <div className="flex flex-wrap items-end gap-2">
          <PaperPicker value={paper} onChange={setPaper} />
          <Button variant="outline" onClick={() => printDebtStatement(debt, paper)}>
            <Printer className="me-2 h-4 w-4" />
            {t("schoolDebts.printStatement")}
          </Button>
          {debt.outstanding > 0 && debt.status !== "CANCELLED" && (
            <Button onClick={() => setRepayOpen(true)}>
              <HandCoins className="me-2 h-4 w-4" />
              {t("schoolDebts.recordRepayment")}
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Field label={t("schoolDebts.principal")} value={money(debt.principal)} />
        <Field
          label={t("schoolDebts.repaid")}
          value={money(debt.repaid)}
          tone="success"
        />
        <Field
          label={t("schoolDebts.outstandingCol")}
          value={money(debt.outstanding)}
          tone={debt.outstanding > 0 ? "danger" : "success"}
        />
        <div className="rounded-xl border bg-card p-4">
          <p className="text-sm text-muted-foreground">{t("schoolDebts.status")}</p>
          <div className="mt-2 flex items-center gap-1.5">
            <Badge
              tone={
                debt.status === "SETTLED"
                  ? "success"
                  : debt.status === "CANCELLED"
                    ? "muted"
                    : debt.overdue
                      ? "danger"
                      : "warning"
              }
            >
              {t(`schoolDebts.status${debt.status}` as never)}
            </Badge>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 text-sm">
        <div className="rounded-xl border bg-card p-4">
          <dl className="space-y-2">
            <Row label={t("schoolDebts.reference")} value={debt.reference || "—"} />
            <Row label={t("schoolDebts.taken")} value={shortDate(debt.takenAt)} />
            <Row
              label={t("schoolDebts.due")}
              value={debt.dueAt ? shortDate(debt.dueAt) : "—"}
            />
            <Row label={t("schoolDebts.recordedBy")} value={debt.recordedBy || "—"} />
            {debt.note && <Row label={t("schoolDebts.note")} value={debt.note} />}
          </dl>
        </div>
      </div>

      <div>
        <h2 className="mb-3 font-semibold">{t("schoolDebts.repaymentHistory")}</h2>
        {debt.repayments.length === 0 ? (
          <p className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">
            {t("schoolDebts.noRepaymentsYet")}
          </p>
        ) : (
          <div className="overflow-x-auto rounded-xl border">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-secondary text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {t("schoolDebts.date")}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {t("schoolDebts.method")}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {t("schoolDebts.reference")}
                  </th>
                  <th className="px-4 py-2.5 text-start font-medium">
                    {t("schoolDebts.recordedBy")}
                  </th>
                  <th className="px-4 py-2.5 text-end font-medium">
                    {t("schoolDebts.amountCol")}
                  </th>
                  {user?.role === "ADMINISTRATOR" && <th className="px-4 py-2.5" />}
                </tr>
              </thead>
              <tbody>
                {debt.repayments.map((r) => (
                  <tr key={r.id} className="border-t">
                    <td className="px-4 py-3">{shortDate(r.paidAt)}</td>
                    <td className="px-4 py-3">{r.method || "—"}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.reference || "—"}</td>
                    <td className="px-4 py-3">{r.recordedBy || "—"}</td>
                    <td className="px-4 py-3 text-end tabular-nums font-medium text-emerald-600 dark:text-emerald-400">
                      {money(r.amount)}
                    </td>
                    {user?.role === "ADMINISTRATOR" && (
                      <td className="px-4 py-3 text-end">
                        <Button
                          variant="ghost"
                          className="h-8 px-2 text-xs text-rose-600 hover:text-rose-700"
                          onClick={() => void removeRepayment(r.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <RepayDialog
        open={repayOpen}
        onClose={() => setRepayOpen(false)}
        remaining={debt.outstanding}
        onSaved={() => {
          setRepayOpen(false);
          void load();
        }}
        debtId={debt.id}
      />
    </div>
  );
}

function Field({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p
        className={cn(
          "mt-1 text-xl font-bold tabular-nums",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "danger" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="text-end font-medium">{value}</dd>
    </div>
  );
}

function RepayDialog({
  open,
  onClose,
  onSaved,
  remaining,
  debtId,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  remaining: number;
  debtId: string;
}) {
  const t = useT();
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [paidAt, setPaidAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setMethod("");
    setReference("");
    setNote("");
    setPaidAt(new Date().toISOString().slice(0, 10));
  }, [open]);

  async function save() {
    const value = Number(amount);
    if (!value || value <= 0) return toast(t("schoolDebts.amountRequired"), "error");
    if (value > remaining) {
      return toast(
        t("schoolDebts.amountExceeds", { remaining: money(remaining) }),
        "error",
      );
    }
    setSaving(true);
    try {
      const dto: CreateRepaymentInput = {
        amount: Math.round(value),
        method: method.trim() || undefined,
        reference: reference.trim() || undefined,
        note: note.trim() || undefined,
        paidAt,
      };
      await apiRepayDebt(debtId, dto);
      toast(t("schoolDebts.repaymentRecorded"), "success");
      onSaved();
    } catch (e) {
      toast(
        e instanceof ApiError ? e.message : t("schoolDebts.saveFailed"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("schoolDebts.recordRepayment")}
      footer={
        <>
          <Button variant="outline" onClick={onClose}>
            {t("schoolDebts.cancel")}
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? t("schoolDebts.saving") : t("schoolDebts.save")}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {t("schoolDebts.remainingOnDebt", { remaining: money(remaining) })}
        </p>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.amountCol")}
          </span>
          <Input
            type="number"
            min={1}
            max={remaining}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t("schoolDebts.method")}
            </span>
            <Input value={method} onChange={(e) => setMethod(e.target.value)} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs text-muted-foreground">
              {t("schoolDebts.reference")}
            </span>
            <Input value={reference} onChange={(e) => setReference(e.target.value)} />
          </label>
        </div>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.date")}
          </span>
          <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.note")}
          </span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}
