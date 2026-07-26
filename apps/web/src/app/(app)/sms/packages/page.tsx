"use client";


import { useT } from "@/lib/i18n/provider";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Loader2,
  Package,
  RefreshCw,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  apiPurchaseSmsPackage,
  apiSmsBalance,
  apiSmsPackages,
  apiSmsPaymentOrders,
  apiSmsPaymentReceipt,
  apiVerifySmsPayment,
  type SmsBalance,
  type SmsPackage,
  type SmsPaymentOrderRow,
  type SmsPaymentReceipt,
} from "@/lib/sms/api";
import { toast } from "@/lib/toast";
import { cn } from "@/lib/utils";

function money(n: string | number, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : n;
  return `${currency} ${Number.isFinite(v) ? v.toFixed(2) : n}`;
}

const STATUS_CLASS: Record<string, string> = {
  SUCCESS: "bg-emerald-500/10 text-emerald-700",
  FAILED: "bg-rose-500/10 text-rose-700",
  EXPIRED: "bg-rose-500/10 text-rose-700",
  PENDING: "bg-amber-500/10 text-amber-700",
  PROCESSING: "bg-sky-500/10 text-sky-700",
  REFUNDED: "bg-violet-500/10 text-violet-700",
  CANCELLED: "bg-muted text-muted-foreground",
};

export default function SchoolSmsPackagesPage() {
  const t = useT();
  const [balance, setBalance] = useState<SmsBalance | null>(null);
  const [packages, setPackages] = useState<SmsPackage[]>([]);
  const [orders, setOrders] = useState<SmsPaymentOrderRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payerAccount, setPayerAccount] = useState("");
  const [channel, setChannel] = useState<"API_PURCHASE" | "HPP_PURCHASE">(
    "API_PURCHASE",
  );
  const [selectedPkg, setSelectedPkg] = useState<string>("");
  const [receipt, setReceipt] = useState<SmsPaymentReceipt | null>(null);
  const [tab, setTab] = useState<"buy" | "history" | "receipt">("buy");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [b, pkgs, ords] = await Promise.all([
        apiSmsBalance(),
        apiSmsPackages(),
        apiSmsPaymentOrders().catch(() => [] as SmsPaymentOrderRow[]),
      ]);
      setBalance(b);
      setPackages(pkgs);
      setOrders(ords);
      setSelectedPkg((prev) => prev || pkgs.find((p) => p.isActive)?.id || "");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load packages", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function buy() {
    if (!selectedPkg) {
      toast("Select a package", "error");
      return;
    }
    if (channel === "API_PURCHASE" && !payerAccount.trim()) {
      toast("Enter the mobile wallet number to pay from", "error");
      return;
    }
    setPayingId(selectedPkg);
    try {
      const res = await apiPurchaseSmsPackage({
        packageId: selectedPkg,
        payerAccount: payerAccount.trim() || undefined,
        channel,
      });
      setReceipt(res);
      if (res.status === "SUCCESS") {
        toast(
          `Payment successful — ${res.credits} SMS credits activated`,
          "success",
        );
        setTab("receipt");
      } else if (res.hppUrl) {
        toast("Redirecting to WaafiPay…", "info");
        window.open(res.hppUrl, "_blank", "noopener,noreferrer");
        setTab("receipt");
      } else {
        toast(`Payment status: ${res.status}`, "info");
        setTab("receipt");
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Payment failed", "error");
    } finally {
      setPayingId(null);
    }
  }

  async function openReceipt(id: string) {
    try {
      const r = await apiSmsPaymentReceipt(id);
      setReceipt(r);
      setTab("receipt");
    } catch (e) {
      toast(e instanceof Error ? e.message : "Failed to load receipt", "error");
    }
  }

  async function verify(id: string) {
    try {
      const r = await apiVerifySmsPayment(id);
      setReceipt(r);
      if (r.status === "SUCCESS") {
        toast("Payment verified — credits activated", "success");
      } else {
        toast(`Status: ${r.status}`, "info");
      }
      await load();
    } catch (e) {
      toast(e instanceof Error ? e.message : "Verification failed", "error");
    }
  }

  const activePurchase = balance?.purchases.find((p) => p.status === "ACTIVE");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold">
            <Package className="h-6 w-6 text-primary" />
            {t("smsPackages.smsPackages")}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smsPackages.buySmsCreditsWithHormuudWaafipay")}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/sms"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border bg-background px-3 text-sm font-medium hover:bg-accent"
          >
            <Wallet className="h-4 w-4" /> {t("smsPackages.sendSms")}
          </Link>
          <Button variant="outline" onClick={() => void load()}>
            <RefreshCw className="mr-2 h-4 w-4" /> {t("smsPackages.refresh")}
          </Button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("smsPackages.remainingBalance")}</p>
          <p className="mt-1 text-3xl font-bold">
            {loading ? "…" : (balance?.creditsRemaining ?? 0)}
          </p>
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("smsPackages.activePackage")}</p>
          <p className="mt-1 text-lg font-semibold">
            {activePurchase?.package.name ?? "None"}
          </p>
          {activePurchase ? (
            <p className="text-xs text-muted-foreground">
              {activePurchase.creditsRemaining} / {activePurchase.creditsTotal}{" "}
              {t("smsPackages.credits")}
            </p>
          ) : null}
        </div>
        <div className="rounded-2xl border bg-card p-4 shadow-sm">
          <p className="text-xs text-muted-foreground">{t("smsPackages.purchases")}</p>
          <p className="mt-1 text-3xl font-bold">
            {balance?.purchases.length ?? 0}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["buy", "Buy package"],
            ["history", "Purchase history"],
            ["receipt", "Receipt"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm",
              tab === id
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-muted-foreground hover:bg-secondary/80",
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "buy" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          <div className="space-y-3">
            {packages.length === 0 ? (
              <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">
                {t("smsPackages.noSmsPackagesPublishedYetContact")}
              </div>
            ) : (
              packages.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPkg(p.id)}
                  className={cn(
                    "w-full rounded-2xl border p-4 text-left shadow-sm transition",
                    selectedPkg === p.id
                      ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                      : "bg-card hover:border-primary/40",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{p.name}</p>
                      {p.description ? (
                        <p className="mt-0.5 text-sm text-muted-foreground">
                          {p.description}
                        </p>
                      ) : null}
                      <p className="mt-2 text-sm">
                        <span className="font-medium">
                          {p.credits.toLocaleString()} {t("smsPackages.sms")}
                        </span>
                      </p>
                    </div>
                    <p className="text-lg font-bold text-primary">
                      {money(p.price, p.currency)}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="flex items-center gap-2 font-semibold">
              <CreditCard className="h-4 w-4" /> {t("smsPackages.payWithWaafipay")}
            </h2>
            <div>
              <Label>{t("smsPackages.paymentChannel")}</Label>
              <Select
                className="mt-1.5"
                value={channel}
                onChange={(e) =>
                  setChannel(e.target.value as "API_PURCHASE" | "HPP_PURCHASE")
                }
              >
                <option value="API_PURCHASE">
                  {t("smsPackages.directMobileWalletEvcZaadSahal")}
                </option>
                <option value="HPP_PURCHASE">{t("smsPackages.hostedPaymentPage")}</option>
              </Select>
            </div>
            <div>
              <Label>{t("smsPackages.payerMobileNumber")}</Label>
              <Input
                className="mt-1.5"
                value={payerAccount}
                onChange={(e) => setPayerAccount(e.target.value)}
                placeholder="252611111111"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                {t("smsPackages.internationalFormatNoRequiredForDirect")}
              </p>
            </div>
            <Button
              className="w-full"
              disabled={!selectedPkg || payingId !== null}
              onClick={() => void buy()}
            >
              {payingId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CreditCard className="mr-2 h-4 w-4" />
              )}
              {t("smsPackages.payActivatePackage")}
            </Button>
            <p className="text-xs text-muted-foreground">
              {t("smsPackages.afterWaafiConfirmsPaymentCreditsAre")}
            </p>
          </div>
        </div>
      ) : null}

      {tab === "history" ? (
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <table className="w-full text-left text-sm">
            <thead className="border-b bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="px-4 py-3">{t("smsPackages.package")}</th>
                <th className="px-4 py-3">{t("smsPackages.amount")}</th>
                <th className="px-4 py-3">{t("smsPackages.status")}</th>
                <th className="px-4 py-3">{t("smsPackages.receipt")}</th>
                <th className="px-4 py-3">{t("smsPackages.date")}</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {orders.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="px-4 py-10 text-center text-muted-foreground"
                  >
                    {t("smsPackages.noPurchasesYet")}
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id} className="border-b last:border-0">
                    <td className="px-4 py-3">
                      <p className="font-medium">{o.package.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {o.credits} {t("smsPackages.credits")}
                      </p>
                    </td>
                    <td className="px-4 py-3">
                      {money(o.amount, o.currency)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={cn(
                          "rounded-full px-2 py-0.5 text-xs font-medium",
                          STATUS_CLASS[o.status] ?? STATUS_CLASS.PENDING,
                        )}
                      >
                        {o.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {o.receiptNumber ?? o.referenceId}
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {new Date(o.paidAt ?? o.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button
                        variant="outline"
                        className="h-8 px-3 text-xs"
                        onClick={() => void openReceipt(o.id)}
                      >
                        {t("smsPackages.view")}
                      </Button>
                      {(o.status === "PENDING" || o.status === "PROCESSING") && (
                        <Button
                          className="ml-2 h-8 px-3 text-xs"
                          onClick={() => void verify(o.id)}
                        >
                          {t("smsPackages.verify")}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {balance && balance.purchases.length > 0 ? (
            <div className="border-t p-4">
              <h3 className="mb-2 text-sm font-semibold">{t("smsPackages.activeCreditWallets")}</h3>
              <ul className="space-y-2 text-sm">
                {balance.purchases.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center justify-between rounded-lg border px-3 py-2"
                  >
                    <span>
                      {p.package.name}{" "}
                      <span className="text-muted-foreground">({p.status})</span>
                    </span>
                    <span className="font-medium">
                      {p.creditsRemaining} / {p.creditsTotal}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      ) : null}

      {tab === "receipt" ? (
        receipt ? (
          <div className="mx-auto max-w-lg space-y-4 rounded-2xl border bg-card p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold">{t("smsPackages.paymentReceipt")}</h2>
              {receipt.status === "SUCCESS" ? (
                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
              ) : null}
            </div>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.status")}</dt>
                <dd className="font-medium">{receipt.status}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.receipt")}</dt>
                <dd className="font-mono text-xs">
                  {receipt.receiptNumber ?? "—"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.package")}</dt>
                <dd className="font-medium">{receipt.package.name}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.credits")}</dt>
                <dd className="font-medium">{receipt.credits}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.amount")}</dt>
                <dd className="font-medium">
                  {money(receipt.amount, receipt.currency)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{t("smsPackages.waafiTxn")}</dt>
                <dd className="font-mono text-xs">
                  {receipt.waafiTransactionId ?? "—"}
                </dd>
              </div>
              <div className="col-span-2">
                <dt className="text-muted-foreground">{t("smsPackages.reference")}</dt>
                <dd className="font-mono text-xs">{receipt.referenceId}</dd>
              </div>
            </dl>
            {receipt.hppUrl && receipt.status !== "SUCCESS" ? (
              <a
                href={receipt.hppUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
              >
                <ExternalLink className="h-4 w-4" /> {t("smsPackages.continueOnWaafipay")}
              </a>
            ) : null}
            {(receipt.status === "PENDING" ||
              receipt.status === "PROCESSING") && (
              <Button
                className="w-full"
                variant="outline"
                onClick={() => void verify(receipt.id)}
              >
                {t("smsPackages.verifyPaymentWithWaafi")}
              </Button>
            )}
            {receipt.failureReason ? (
              <p className="text-sm text-rose-600">{receipt.failureReason}</p>
            ) : null}
            {receipt.auditLogs.length > 0 ? (
              <div>
                <h3 className="mb-2 text-sm font-semibold">{t("smsPackages.auditTrail")}</h3>
                <ul className="max-h-48 space-y-1 overflow-y-auto text-xs text-muted-foreground">
                  {receipt.auditLogs.map((a) => (
                    <li key={a.id}>
                      {new Date(a.createdAt).toLocaleString()} — {a.action}:{" "}
                      {a.message}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="text-center text-muted-foreground">
            {t("smsPackages.selectAPurchaseFromHistoryTo")}
          </p>
        )
      ) : null}
    </div>
  );
}
