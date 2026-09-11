"use client";

import { useMemo } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Clock,
  MessageSquare,
  Send,
  Wallet,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { useT, type TranslationKey } from "@/lib/i18n/provider";
import { useCachedResource } from "@/lib/cached-resource";
import { useHydrated } from "@/lib/use-hydrated";

/**
 * What this school's SMS is actually doing.
 *
 * Every figure comes from the message rows themselves — there is no static
 * number on this page, which is the whole point of it: a communication budget
 * a school cannot see is one it discovers halfway through a term.
 *
 * Credits, not messages. A long message costs several credits per recipient,
 * so counting messages would tell a school it has plenty left while the
 * balance runs out underneath.
 */

interface Usage {
  today: number;
  thisMonth: number;
  allTime: number;
  failed: number;
  pending: number;
  daily: { date: string; credits: number }[];
}

interface Balance {
  creditsRemaining: number;
  school: { sendingName?: string | null; smsEnabled: boolean };
  /**
   * The school's own SMS account, as much of it as a school may see: who it is
   * to the platform, the name it sends under, whether it may send, and any
   * ceiling set for it. No endpoint, no key, no secret — the school uses the
   * service, the platform owner configures it.
   */
  account?: {
    accountNo: string;
    senderId: string;
    status: "ACTIVE" | "INACTIVE" | "SUSPENDED";
    suspendedReason: string | null;
    provider: string;
    dailyLimit: number;
    monthlyLimit: number;
  };
  provider: { canSend: boolean; message: string; status: string };
  purchases: {
    id: string;
    creditsRemaining: number;
    creditsTotal?: number;
    status: string;
    expiresAt?: string | null;
    package?: { name: string; credits: number } | null;
  }[];
  deliveryStats: { status: string; count: number; credits: number }[];
}

interface Message {
  id: string;
  body: string;
  recipientName: string | null;
  recipientPhone: string;
  status: string;
  creditsUsed: number;
  createdAt: string;
}

const axisStyle = { fontSize: 11, fill: "hsl(var(--muted-foreground))" };

const tooltipStyle = {
  borderRadius: 12,
  border: "1px solid hsl(var(--border))",
  background: "hsl(var(--card))",
  color: "hsl(var(--card-foreground))",
  fontSize: 12,
};

function statusTone(status: string): string {
  switch (status) {
    case "DELIVERED":
    case "SENT":
      return "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300";
    case "FAILED":
    case "REJECTED":
      return "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300";
    default:
      return "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300";
  }
}

export default function SmsDashboardPage() {
  const t = useT();
  const mounted = useHydrated();

  const { data: usage } = useCachedResource<Usage>(
    mounted ? "/sms/usage?days=30" : null,
  );
  const { data: balance } = useCachedResource<Balance>(
    mounted ? "/sms/balance" : null,
  );
  const { data: messages } = useCachedResource<{ items?: Message[] } | Message[]>(
    mounted ? "/sms/messages?take=8" : null,
  );

  const recent = useMemo<Message[]>(() => {
    if (!messages) return [];
    return Array.isArray(messages) ? messages : (messages.items ?? []);
  }, [messages]);

  const chart = useMemo(
    () =>
      (usage?.daily ?? []).map((d) => ({
        label: d.date.slice(5),
        credits: d.credits,
      })),
    [usage],
  );

  const cards: {
    key: string;
    label: TranslationKey;
    value: number | null;
    icon: typeof Send;
    tone: string;
  }[] = [
    {
      key: "balance",
      label: "smsDashboard.balance",
      value: balance?.creditsRemaining ?? null,
      icon: Wallet,
      tone: "text-blue-600 dark:text-blue-400",
    },
    {
      key: "today",
      label: "smsDashboard.sentToday",
      value: usage?.today ?? null,
      icon: Send,
      tone: "text-emerald-600 dark:text-emerald-400",
    },
    {
      key: "month",
      label: "smsDashboard.sentThisMonth",
      value: usage?.thisMonth ?? null,
      icon: MessageSquare,
      tone: "text-violet-600 dark:text-violet-400",
    },
    {
      key: "failed",
      label: "smsDashboard.failed",
      value: usage?.failed ?? null,
      icon: AlertTriangle,
      tone: "text-rose-600 dark:text-rose-400",
    },
    {
      key: "pending",
      label: "smsDashboard.pending",
      value: usage?.pending ?? null,
      icon: Clock,
      tone: "text-amber-600 dark:text-amber-400",
    },
  ];

  const activePackages = (balance?.purchases ?? []).filter(
    (p) => p.status === "ACTIVE",
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("smsDashboard.title")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("smsDashboard.intro")}
          </p>
        </div>
        <Link
          href="/sms"
          className="inline-flex h-10 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:opacity-90"
        >
          <Send className="me-2 h-4 w-4" />
          {t("smsDashboard.sendSms")}
        </Link>
      </div>

      {/* The one line that decides whether anything else on this page matters. */}
      {balance && !balance.provider.canSend && (
        <p className="rounded-lg border border-amber-300/60 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
          {balance.provider.message}
        </p>
      )}

      {/* The account itself. A school asking "can we send, and under what
          name?" had to read three different screens for the answer. */}
      {balance?.account && (
        <div className="rounded-xl border bg-card p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-semibold">{t("smsAccount.title")}</h2>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {t("smsAccount.managedNote")}
              </p>
            </div>
            <span
              className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                balance.account.status === "ACTIVE"
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300"
                  : balance.account.status === "SUSPENDED"
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/15 dark:text-rose-300"
                    : "bg-secondary text-muted-foreground"
              }`}
            >
              {t(
                balance.account.status === "ACTIVE"
                  ? "smsAccount.active"
                  : balance.account.status === "SUSPENDED"
                    ? "smsAccount.suspended"
                    : "smsAccount.inactive",
              )}
            </span>
          </div>

          {balance.account.status === "SUSPENDED" && (
            <p className="mt-3 rounded-lg border border-rose-300/60 bg-rose-50 p-3 text-sm text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              {balance.account.suspendedReason || t("smsAccount.suspendedNote")}
            </p>
          )}

          <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <AccountFact label={t("smsAccount.accountNo")}>
              <span className="font-mono text-xs">
                {balance.account.accountNo}
              </span>
            </AccountFact>
            <AccountFact label={t("smsAccount.senderId")}>
              {balance.account.senderId || "—"}
            </AccountFact>
            <AccountFact label={t("smsAccount.provider")}>
              {balance.account.provider}
            </AccountFact>
            <AccountFact label={t("smsAccount.limits")}>
              {/* Zero is the absence of a ceiling, not a ceiling of zero. */}
              {balance.account.dailyLimit === 0 &&
              balance.account.monthlyLimit === 0
                ? t("smsAccount.noLimit")
                : [
                    balance.account.dailyLimit > 0
                      ? `${balance.account.dailyLimit.toLocaleString()}/${t("smsAccount.day")}`
                      : null,
                    balance.account.monthlyLimit > 0
                      ? `${balance.account.monthlyLimit.toLocaleString()}/${t("smsAccount.month")}`
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
            </AccountFact>
          </dl>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.key} className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
              <c.icon className="h-4 w-4" />
              {t(c.label)}
            </div>
            <p className={`mt-2 text-2xl font-bold tabular-nums ${c.tone}`}>
              {c.value === null ? "—" : c.value.toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-6 xl:grid-cols-3">
        <section className="rounded-2xl border bg-card p-5 shadow-sm xl:col-span-2">
          <h2 className="text-sm font-semibold">{t("smsDashboard.usage30")}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {t("smsDashboard.usageNote")}
          </p>
          <div className="mt-3">
            <ResponsiveContainer width="100%" height={220}>
              <BarChart
                data={chart}
                margin={{ top: 10, right: 8, left: -18, bottom: 0 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="hsl(var(--border))"
                />
                <XAxis
                  dataKey="label"
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  interval="preserveStartEnd"
                  minTickGap={18}
                />
                <YAxis
                  tick={axisStyle}
                  tickLine={false}
                  axisLine={false}
                  width={44}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: "hsl(var(--muted))", opacity: 0.4 }}
                  formatter={(v: number) => [
                    v.toLocaleString(),
                    t("smsDashboard.credits"),
                  ]}
                />
                <Bar dataKey="credits" fill="#2563eb" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-2xl border bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold">
              {t("smsDashboard.packages")}
            </h2>
            <Link
              href="/sms/packages"
              className="text-xs font-medium text-primary hover:underline"
            >
              {t("smsDashboard.viewAll")}
            </Link>
          </div>
          {activePackages.length === 0 ? (
            <p className="mt-4 rounded-lg border bg-secondary/30 p-4 text-center text-sm text-muted-foreground">
              {t("smsDashboard.noPackage")}
            </p>
          ) : (
            <ul className="mt-3 space-y-2">
              {activePackages.map((p) => (
                <li key={p.id} className="rounded-lg border p-3">
                  <p className="text-sm font-medium">
                    {p.package?.name ?? t("smsDashboard.packages")}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.creditsRemaining.toLocaleString()}{" "}
                    {t("smsDashboard.remaining")}
                    {p.expiresAt
                      ? ` · ${new Date(p.expiresAt).toISOString().slice(0, 10)}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex items-center justify-between gap-2 border-b p-5">
          <h2 className="text-sm font-semibold">{t("smsDashboard.recent")}</h2>
          <Link
            href="/sms"
            className="text-xs font-medium text-primary hover:underline"
          >
            {t("smsDashboard.viewAll")}
          </Link>
        </div>
        {recent.length === 0 ? (
          <p className="p-8 text-center text-sm text-muted-foreground">
            {t("smsDashboard.nothingYet")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/40 text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="p-3 text-start">{t("smsDashboard.when")}</th>
                  <th className="p-3 text-start">{t("smsDashboard.to")}</th>
                  <th className="p-3 text-start">{t("smsDashboard.message")}</th>
                  <th className="p-3 text-end">{t("smsDashboard.credits")}</th>
                  <th className="p-3 text-start">{t("smsDashboard.status")}</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {recent.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap p-3 text-muted-foreground">
                      {new Date(m.createdAt).toLocaleString()}
                    </td>
                    <td className="p-3">
                      {m.recipientName || m.recipientPhone}
                    </td>
                    <td className="max-w-sm truncate p-3 text-muted-foreground">
                      {m.body}
                    </td>
                    <td className="p-3 text-end tabular-nums">
                      {m.creditsUsed}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusTone(m.status)}`}
                      >
                        {m.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

/** One labelled fact on the account card. */
function AccountFact({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-sm font-medium">{children}</dd>
    </div>
  );
}
