"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Globe } from "lucide-react";
import { LANGUAGES, type Lang } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";

/**
 * Language picker. Each option is written in its own language — somebody who
 * cannot read the current one still has to be able to find theirs.
 */
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const current = LANGUAGES.find((l) => l.code === lang);

  function choose(code: Lang) {
    setOpen(false);
    if (code !== lang) setLang(code);
  }

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("topbar.language")}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-muted-foreground transition-colors hover:bg-secondary"
      >
        <Globe className="h-5 w-5" />
        <span className="hidden text-sm font-medium sm:inline">
          {current?.native}
        </span>
      </button>

      {open && (
        <div
          role="listbox"
          className="absolute end-0 z-50 mt-1 min-w-40 overflow-hidden rounded-lg border bg-popover p-1 shadow-lg"
        >
          {LANGUAGES.map((l) => (
            <button
              key={l.code}
              role="option"
              aria-selected={l.code === lang}
              onClick={() => choose(l.code)}
              // Each entry reads in its own direction, so Arabic sits
              // right-aligned even while the app is still in English.
              dir={l.dir}
              className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-sm transition-colors hover:bg-secondary ${
                l.code === lang ? "font-semibold" : ""
              }`}
            >
              <span>{l.native}</span>
              {l.code === lang && <Check className="h-4 w-4 shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
