import {
  fetchPlatformSmsPayments,
  fetchPlatformSubscriptionHistory,
} from "./api";

export type PlatformEventType = "SUBSCRIPTION" | "SMS_PURCHASE";

export interface PlatformEvent {
  id: string;
  type: PlatformEventType;
  schoolId: string;
  schoolName: string;
  subdomain: string;
  title: string;
  detail: string;
  status: string;
  occurredAt: string;
}

const SUBSCRIPTION_ACTION_LABEL: Record<string, string> = {
  ASSIGN: "subscribed to",
  RENEW: "renewed",
  CANCEL: "cancelled",
  EXPIRE: "expired from",
  SELF_PURCHASE: "self-purchased",
  ACTIVATED: "activated",
};

function money(n: string | number, currency = "USD") {
  const v = typeof n === "string" ? Number(n) : n;
  return `${currency} ${Number.isFinite(v) ? v.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : n}`;
}

/** Merges subscription assignments and SMS package purchases into one
 *  time-ordered feed — no backend event/notification table exists yet, so
 *  this is built client-side from the two sources that already record the
 *  data (subscription history + SMS payment orders), each already capped
 *  at the most recent 100 rows server-side. */
export async function fetchPlatformEvents(): Promise<PlatformEvent[]> {
  const [history, payments] = await Promise.all([
    fetchPlatformSubscriptionHistory({ pageSize: 100 }),
    fetchPlatformSmsPayments(),
  ]);

  const subscriptionEvents: PlatformEvent[] = history.rows.map((r) => ({
    id: `sub_${r.id}`,
    type: "SUBSCRIPTION",
    schoolId: r.school.id,
    schoolName: r.school.name,
    subdomain: r.school.subdomain,
    title: `${r.school.name} ${SUBSCRIPTION_ACTION_LABEL[r.action] ?? r.action.toLowerCase()} the ${r.plan} plan`,
    detail: `by ${r.assignedBy}`,
    status: r.status,
    occurredAt: r.createdAt,
  }));

  const smsEvents: PlatformEvent[] = payments.orders
    .filter((o) => o.status === "SUCCESS")
    .map((o) => ({
      id: `sms_${o.id}`,
      type: "SMS_PURCHASE",
      schoolId: o.school.id,
      schoolName: o.school.name,
      subdomain: o.school.subdomain,
      title: `${o.school.name} purchased ${o.credits.toLocaleString()} SMS credits`,
      detail: `${o.package.name} · ${money(o.amount, o.currency)}`,
      status: o.status,
      occurredAt: o.paidAt ?? o.createdAt,
    }));

  return [...subscriptionEvents, ...smsEvents].sort(
    (a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime(),
  );
}

const LAST_SEEN_KEY = "platform_notifications_last_seen";

export function getLastSeenAt(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(LAST_SEEN_KEY);
}

export function markNotificationsSeen(): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(LAST_SEEN_KEY, new Date().toISOString());
}

export function countUnread(events: PlatformEvent[], lastSeenAt: string | null): number {
  if (!lastSeenAt) return events.length;
  const cutoff = new Date(lastSeenAt).getTime();
  return events.filter((e) => new Date(e.occurredAt).getTime() > cutoff).length;
}
