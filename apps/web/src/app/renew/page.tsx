"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { api, getAccessToken, setAccessToken } from "@/lib/api";

interface Plan {
  id: string;
  name: string;
  description?: string | null;
  /**
   * What this school will actually be charged, worked out by the server.
   *
   * Not the plan's list price: a plan can be priced per student, so the amount
   * depends on how many this school has. Reading priceUsd here would show one
   * number on the screen and take another off the card.
   */
  computedMonthlyPriceUsd?: number | string | null;
  computedYearlyPriceUsd?: number | string | null;
  maxStudents?: number | null;
  maxTeachers?: number | null;
  isCurrent?: boolean;
}

interface Mine {
  status?: string;
  planName?: string | null;
  endDate?: string | null;
  message?: string | null;
}

type Cycle = "MONTHLY" | "YEARLY";

/** Decimals cross the wire as strings; both have to render as one price. */
function money(n: number | string | null | undefined): string {
  if (n === null || n === undefined || n === "") return "—";
  const v = typeof n === "string" ? Number(n) : n;
  return Number.isFinite(v) ? `$${v.toFixed(2)}` : "—";
}

/**
 * Renew a lapsed subscription, without anybody having to be telephoned.
 *
 * A school whose plan ran out could not sign in, and the screen that sells a
 * plan was behind sign-in. The only way back was to contact the platform
 * owner and wait — at the start of a term, on a weekend, in the evening. The
 * sign-in that fails now hands an administrator a token scoped to billing and
 * sends them here: the plans, a price, a payment, and the school opens itself.
 *
 * The token reaches four routes and no others; there is nothing to see on this
 * page that is not the school's own billing position.
 */
export default function RenewPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [mine, setMine] = useState<Mine | null>(null);
  const [loading, setLoading] = useState(true);
  const [planId, setPlanId] = useState("");
  const [cycle, setCycle] = useState<Cycle>("MONTHLY");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderId, setOrderId] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  useEffect(() => {
    // No token means the visitor arrived here directly rather than off a
    // failed sign-in. There is nothing for them here.
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    void (async () => {
      try {
        const [p, m] = await Promise.all([
          api<Plan[]>("/subscriptions/plans"),
          api<Mine>("/subscriptions/me").catch(() => null),
        ]);
        setPlans(p);
        setMine(m);
        setPlanId(p.find((x) => x.isCurrent)?.id ?? p[0]?.id ?? "");
      } catch (e) {
        setError(e instanceof Error ? e.message : "Could not load the plans.");
      } finally {
        setLoading(false);
      }
    })();
  }, [router]);

  const chosen = plans.find((p) => p.id === planId) ?? null;
  const price =
    cycle === "YEARLY"
      ? chosen?.computedYearlyPriceUsd
      : chosen?.computedMonthlyPriceUsd;

  async function pay() {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      // `payerAccount` is what the server asks for, and what Waafi pushes the
      // approval to. The receipt comes straight back: an API purchase is
      // approved on the phone, a hosted one sends the payer to Waafi's page.
      const res = await api<{
        id: string;
        status: string;
        hppUrl?: string | null;
      }>("/subscriptions/purchase", {
        method: "POST",
        body: {
          planId: chosen.id,
          billingCycle: cycle,
          payerAccount: phone.trim(),
        },
      });
      setOrderId(res.id);
      if (res.status === "SUCCESS") {
        // Some wallets settle immediately; there is nothing to wait for.
        setAccessToken(null);
        setDone(true);
        return;
      }
      if (res.hppUrl) window.location.href = res.hppUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start the payment.");
    } finally {
      setBusy(false);
    }
  }

  async function check() {
    if (!orderId) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/subscriptions/payments/${orderId}/verify`, { method: "POST" });
      // The school is open again. The renewal token has done its one job, so
      // it goes rather than sitting in the browser until it expires.
      setAccessToken(null);
      setDone(true);
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Payment not confirmed yet. Try again in a moment.",
      );
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (done) {
    return (
      <main className="flex min-h-screen items-center justify-center p-4">
        <div className="w-full max-w-md rounded-2xl border bg-card p-8 text-center shadow-sm">
          <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-7 w-7" />
          </span>
          <h1 className="mt-4 text-xl font-bold">Your school is open again</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            The payment went through and the plan is active. Sign in as usual.
          </p>
          <Button className="mt-5 w-full" onClick={() => router.push("/login")}>
            Sign in
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-3xl p-4 py-10">
      <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-5">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600 dark:text-amber-400" />
          <div>
            <h1 className="text-lg font-bold text-amber-900 dark:text-amber-300">
              Your subscription has ended
            </h1>
            <p className="mt-1 text-sm text-amber-800/90 dark:text-amber-300/90">
              {mine?.planName
                ? `Your ${mine.planName} plan is no longer active.`
                : "This school has no active plan."}{" "}
              Choose a plan below and pay for it — the school opens as soon as
              the payment clears. Nobody needs to be contacted.
            </p>
          </div>
        </div>
      </div>

      <h2 className="mt-8 font-semibold">Plans</h2>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        {plans.map((p) => {
          const on = p.id === planId;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => setPlanId(p.id)}
              className={cn(
                "rounded-2xl border p-4 text-start transition-all",
                on
                  ? "border-primary bg-primary/5 ring-2 ring-primary/30"
                  : "bg-card hover:-translate-y-0.5 hover:shadow-sm",
              )}
            >
              <p className="font-semibold">{p.name}</p>
              {p.description && (
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {p.description}
                </p>
              )}
              <p className="mt-2 text-2xl font-bold tabular-nums">
                {money(p.computedMonthlyPriceUsd)}
                <span className="text-sm font-normal text-muted-foreground">
                  {" "}
                  / month
                </span>
              </p>
              {p.computedYearlyPriceUsd ? (
                <p className="text-xs text-muted-foreground">
                  {money(p.computedYearlyPriceUsd)} / year
                </p>
              ) : null}
              <p className="mt-2 text-xs text-muted-foreground">
                {p.maxStudents ? `${p.maxStudents} students` : "Unlimited students"}
                {p.maxTeachers ? ` · ${p.maxTeachers} teachers` : ""}
              </p>
            </button>
          );
        })}
      </div>

      <div className="mt-6 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Billing
            </label>
            <Select
              value={cycle}
              onChange={(e) => setCycle(e.target.value as Cycle)}
            >
              <option value="MONTHLY">Monthly</option>
              <option value="YEARLY">Yearly</option>
            </Select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Phone to charge
            </label>
            <Input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="61xxxxxxx"
              inputMode="tel"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm">
            <span className="text-muted-foreground">To pay: </span>
            <span className="text-xl font-bold tabular-nums">
              {money(price)}
            </span>
          </p>
          {orderId ? (
            <Button disabled={busy} onClick={() => void check()}>
              {busy ? (
                <Loader2 className="me-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="me-2 h-4 w-4" />
              )}
              I have paid — check now
            </Button>
          ) : (
            <Button disabled={busy || !chosen || !phone.trim()} onClick={() => void pay()}>
              {busy && <Loader2 className="me-2 h-4 w-4 animate-spin" />}
              Pay {money(price)}
            </Button>
          )}
        </div>

        {orderId && !error && (
          <p className="mt-3 text-xs text-muted-foreground">
            Approve the payment on your phone, then press “check now”. The
            school opens the moment the payment is confirmed.
          </p>
        )}

        {error && (
          <p className="mt-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-400">
            {error}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => {
          setAccessToken(null);
          router.push("/login");
        }}
        className="mt-6 inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" /> Back to sign in
      </button>
    </main>
  );
}
