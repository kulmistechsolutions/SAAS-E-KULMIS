"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  CircleDollarSign,
  HandCoins,
  Landmark,
  Plus,
  Wallet,
} from "lucide-react";
import { useT } from "@/lib/i18n/provider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";
import { money } from "@/lib/students/format";
import { shortDate } from "@/lib/students/format";
import { ApiError } from "@/lib/api";
import {
  apiCreateDebt,
  apiDebtsSummary,
  apiListDebts,
  type CreateDebtInput,
} from "@/lib/debts/api";
import type { DebtsSummary, SchoolDebt } from "@/lib/debts/types";

function apiErr(e: unknown, fallback: string): string {
  return e instanceof ApiError ? e.message : fallback;
}

/**
 * What the school owes, and what it has paid back.
 *
 * A loan sat nowhere in the product before this: not income when it arrived,
 * not an expense category that fit the repayments, so a school with a bank
 * loan tracked it on paper or not at all. This is deliberately a ledger, not
 * a single balance — every repayment is its own row, because "how much do we
 * still owe the bank" only has a trustworthy answer when every payment
 * against it can be shown.
 */
export default function SchoolDebtsPage() {
  const t = useT();
  const [debts, setDebts] = useState<SchoolDebt[]>([]);
  const [summary, setSummary] = useState<DebtsSummary | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [loading, setLoading] = useState(true);
  const [addOpen, setAddOpen] = useState(false);

  const load = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const [rows, sum] = await Promise.all([
        apiListDebts(status || undefined),
        apiDebtsSummary(),
      ]);
      setDebts(rows);
      setSummary(sum);
    } catch (e) {
      toast(apiErr(e, t("schoolDebts.loadFailed")), "error");
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load(statusFilter);
  }, [load, statusFilter]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Landmark className="h-6 w-6 text-primary" />
            {t("schoolDebts.title")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("schoolDebts.description")}
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="me-2 h-4 w-4" />
          {t("schoolDebts.recordDebt")}
        </Button>
      </div>

      {summary && (
        <div className="grid gap-4 sm:grid-cols-3">
          <SummaryCard
            icon={HandCoins}
            label={t("schoolDebts.totalBorrowed")}
            value={money(summary.borrowed)}
            tone="default"
          />
          <SummaryCard
            icon={CircleDollarSign}
            label={t("schoolDebts.totalRepaid")}
            value={money(summary.repaid)}
            tone="success"
          />
          <SummaryCard
            icon={Wallet}
            label={t("schoolDebts.stillOwed")}
            value={money(summary.outstanding)}
            tone={summary.outstanding > 0 ? "danger" : "success"}
          />
        </div>
      )}

      <div className="flex items-center gap-3">
        <label className="text-sm">
          <span className="sr-only">{t("schoolDebts.status")}</span>
          <Select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-9"
          >
            <option value="">{t("schoolDebts.allDebts")}</option>
            <option value="OPEN">{t("schoolDebts.open")}</option>
            <option value="SETTLED">{t("schoolDebts.settled")}</option>
            <option value="CANCELLED">{t("schoolDebts.cancelled")}</option>
          </Select>
        </label>
      </div>

      {loading ? (
        <p className="text-muted-foreground">{t("schoolDebts.loading")}</p>
      ) : debts.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <Landmark className="mx-auto h-8 w-8 text-muted-foreground" />
          <p className="mt-3 font-medium">{t("schoolDebts.noneTitle")}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("schoolDebts.noneHelp")}
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-secondary text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("schoolDebts.lender")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("schoolDebts.taken")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("schoolDebts.due")}
                </th>
                <th className="px-4 py-2.5 text-end font-medium">
                  {t("schoolDebts.principal")}
                </th>
                <th className="px-4 py-2.5 text-end font-medium">
                  {t("schoolDebts.repaid")}
                </th>
                <th className="px-4 py-2.5 text-end font-medium">
                  {t("schoolDebts.outstandingCol")}
                </th>
                <th className="px-4 py-2.5 text-start font-medium">
                  {t("schoolDebts.status")}
                </th>
                <th className="px-4 py-2.5" />
              </tr>
            </thead>
            <tbody>
              {debts.map((d) => (
                <tr key={d.id} className="border-t">
                  <td className="px-4 py-3">
                    <p className="font-medium">{d.lender}</p>
                    {d.purpose && (
                      <p className="text-xs text-muted-foreground">{d.purpose}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">{shortDate(d.takenAt)}</td>
                  <td className="px-4 py-3">
                    {d.dueAt ? (
                      <span
                        className={cn(
                          d.overdue && "font-medium text-rose-600 dark:text-rose-400",
                        )}
                      >
                        {shortDate(d.dueAt)}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums">
                    {money(d.principal)}
                  </td>
                  <td className="px-4 py-3 text-end tabular-nums text-emerald-600 dark:text-emerald-400">
                    {money(d.repaid)}
                  </td>
                  <td className="px-4 py-3 text-end font-semibold tabular-nums">
                    {money(d.outstanding)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Badge
                        tone={
                          d.status === "SETTLED"
                            ? "success"
                            : d.status === "CANCELLED"
                              ? "muted"
                              : d.overdue
                                ? "danger"
                                : "warning"
                        }
                      >
                        {t(`schoolDebts.status${d.status}` as never)}
                      </Badge>
                      {d.overdue && (
                        <AlertTriangle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-400" />
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-end">
                    <Link href={`/finance/debts/${d.id}`}>
                      <Button variant="outline" className="h-8 px-3 text-xs">
                        {t("schoolDebts.view")}
                      </Button>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <AddDebtDialog
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaved={() => {
          setAddOpen(false);
          void load(statusFilter);
        }}
      />
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Landmark;
  label: string;
  value: string;
  tone: "default" | "success" | "danger";
}) {
  return (
    <div className="rounded-xl border bg-card p-4">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <p
        className={cn(
          "mt-2 text-2xl font-bold tabular-nums",
          tone === "success" && "text-emerald-600 dark:text-emerald-400",
          tone === "danger" && "text-rose-600 dark:text-rose-400",
        )}
      >
        {value}
      </p>
    </div>
  );
}

function AddDebtDialog({
  open,
  onClose,
  onSaved,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}) {
  const t = useT();
  const [lender, setLender] = useState("");
  const [purpose, setPurpose] = useState("");
  const [principal, setPrincipal] = useState("");
  const [reference, setReference] = useState("");
  const [takenAt, setTakenAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [dueAt, setDueAt] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLender("");
    setPurpose("");
    setPrincipal("");
    setReference("");
    setTakenAt(new Date().toISOString().slice(0, 10));
    setDueAt("");
    setNote("");
  }, [open]);

  async function save() {
    const amount = Number(principal);
    if (!lender.trim()) return toast(t("schoolDebts.lenderRequired"), "error");
    if (!amount || amount <= 0) return toast(t("schoolDebts.amountRequired"), "error");

    setSaving(true);
    try {
      const dto: CreateDebtInput = {
        lender: lender.trim(),
        principal: Math.round(amount),
        purpose: purpose.trim() || undefined,
        reference: reference.trim() || undefined,
        takenAt,
        dueAt: dueAt || null,
        note: note.trim() || undefined,
      };
      await apiCreateDebt(dto);
      toast(t("schoolDebts.recorded"), "success");
      onSaved();
    } catch (e) {
      toast(apiErr(e, t("schoolDebts.saveFailed")), "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title={t("schoolDebts.recordDebt")}
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
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.lender")}
          </span>
          <Input value={lender} onChange={(e) => setLender(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.purpose")}
          </span>
          <Input value={purpose} onChange={(e) => setPurpose(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.principal")}
          </span>
          <Input
            type="number"
            min={1}
            value={principal}
            onChange={(e) => setPrincipal(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.reference")}
          </span>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.taken")}
          </span>
          <Input
            type="date"
            value={takenAt}
            onChange={(e) => setTakenAt(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.due")}
          </span>
          <Input type="date" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
        </label>
        <label className="text-sm sm:col-span-2">
          <span className="mb-1 block text-xs text-muted-foreground">
            {t("schoolDebts.note")}
          </span>
          <Input value={note} onChange={(e) => setNote(e.target.value)} />
        </label>
      </div>
    </Dialog>
  );
}
