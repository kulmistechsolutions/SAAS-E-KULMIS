"use client";

import { useEffect, type ReactNode } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** When false, the dialog grows to fit content (no inner scroll). */
  scrollable?: boolean;
}

export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  className,
  scrollable = true,
}: DialogProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? "dialog-title" : undefined}
        aria-describedby={description ? "dialog-description" : undefined}
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "animate-fade-up relative z-10 flex w-full flex-col overflow-hidden rounded-2xl border bg-card shadow-xl",
          "max-w-[calc(100vw-1.5rem)]",
          scrollable ? "max-h-[min(92dvh,920px)]" : "max-h-[96dvh]",
          !className && "sm:max-w-lg",
          className,
        )}
      >
        {(title || description) && (
          <div className="flex shrink-0 items-start justify-between gap-3 border-b px-4 py-2.5 sm:px-5">
            <div className="min-w-0 pr-2">
              {title && (
                <h2
                  id="dialog-title"
                  className="text-base font-semibold leading-tight text-foreground"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p
                  id="dialog-description"
                  className="mt-0.5 text-xs text-muted-foreground"
                >
                  {description}
                </p>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-secondary"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        <div
          className={cn(
            "overflow-y-auto overscroll-contain scrollbar-none px-4 py-2.5 sm:px-5",
            scrollable && "min-h-0 flex-1",
          )}
        >
          {children}
        </div>

        {footer && (
          <div className="flex shrink-0 flex-col-reverse gap-2 border-t bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-5 [&_button]:w-full sm:[&_button]:w-auto">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
