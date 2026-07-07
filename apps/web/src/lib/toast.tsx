"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

export type ToastTone = "success" | "error" | "info";
export interface Toast {
  id: number;
  message: string;
  tone: ToastTone;
}

const EVENT = "ekulmis:toast";

/**
 * Fire a toast. Uses a window CustomEvent so it works no matter how many
 * bundle copies of this module exist (module-level state is not reliably
 * shared across Next.js client chunks).
 */
export function toast(message: string, tone: ToastTone = "success") {
  if (typeof window === "undefined") return;
  window.dispatchEvent(
    new CustomEvent(EVENT, { detail: { message, tone } }),
  );
}

const ICONS = {
  success: CheckCircle2,
  error: XCircle,
  info: Info,
};

const TONES = {
  success: "border-emerald-500/30 text-emerald-700 dark:text-emerald-400",
  error: "border-rose-500/30 text-rose-700 dark:text-rose-400",
  info: "border-sky-500/30 text-sky-700 dark:text-sky-400",
};

export function Toaster() {
  const [items, setItems] = useState<Toast[]>([]);

  useEffect(() => {
    let seq = 0;
    function onToast(e: Event) {
      const detail = (e as CustomEvent<{ message: string; tone: ToastTone }>)
        .detail;
      const id = ++seq;
      setItems((prev) => [...prev, { id, message: detail.message, tone: detail.tone }]);
      setTimeout(() => {
        setItems((prev) => prev.filter((t) => t.id !== id));
      }, 5000);
    }
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  function dismiss(id: number) {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-full max-w-sm flex-col gap-2">
      {items.map((t) => {
        const Icon = ICONS[t.tone];
        return (
          <div
            key={t.id}
            className={`animate-fade-up pointer-events-auto flex items-start gap-3 rounded-xl border bg-card px-4 py-3 text-sm shadow-lg ${TONES[t.tone]}`}
          >
            <Icon className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="flex-1 text-foreground">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="text-muted-foreground transition-colors hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
