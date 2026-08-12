"use client";

import { useSyncExternalStore } from "react";
import {
  apiListMyNotifications,
  apiMarkNotificationRead,
  type ApiUserNotification,
} from "./api";

/**
 * The staff notification bell's own store. This is deliberately separate
 * from the parent-portal / teacher-portal stores — those are scoped to a
 * portal session and hydrate differently — but every one of them ultimately
 * reads the same `/notifications` family of endpoints keyed off whoever the
 * bearer token belongs to.
 */
interface NotificationsState {
  items: ApiUserNotification[];
  loaded: boolean;
}

let state: NotificationsState = { items: [], loaded: false };
const listeners = new Set<() => void>();

function setState(next: NotificationsState) {
  state = next;
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function getState(): NotificationsState {
  return state;
}

export async function refreshMyNotifications(): Promise<void> {
  try {
    const items = await apiListMyNotifications();
    setState({ items, loaded: true });
  } catch {
    setState({ items: [], loaded: true });
  }
}

export async function markMyNotificationRead(id: string): Promise<void> {
  setState({
    ...state,
    items: state.items.map((n) => (n.id === id ? { ...n, readAt: new Date().toISOString() } : n)),
  });
  try {
    await apiMarkNotificationRead(id);
  } catch {
    // Optimistic update stands even if the write fails silently — the next
    // refresh reconciles it.
  }
}

export function useMyNotifications(): NotificationsState {
  return useSyncExternalStore(subscribe, getState, () => ({ items: [], loaded: false }));
}

export function myUnreadCount(): number {
  return state.items.filter((n) => !n.readAt).length;
}
