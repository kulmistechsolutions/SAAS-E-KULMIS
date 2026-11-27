"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

/**
 * A drop-down that floats above the page instead of inside its button's box.
 *
 * Menus drawn inside a card were cut off by the card's own edge (a student's
 * header has overflow hidden for its rounded corners, so the Download list
 * showed one item and a half). This draws the menu on <body>, pinned under
 * its button — or above it when there is no room below — and closes on a
 * click anywhere else, on Escape, or when the page scrolls away from it.
 */
export function FloatingMenu({
  anchorRef,
  open,
  onClose,
  width = 256,
  className,
  children,
}: {
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
  width?: number;
  className?: string;
  children: ReactNode;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; maxHeight: number } | null>(null);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const a = anchorRef.current?.getBoundingClientRect();
      if (!a) return;
      const gap = 6;
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      const rtl = document.documentElement.dir === "rtl";
      let left = rtl ? a.left : a.right - width;
      left = Math.max(8, Math.min(left, vw - width - 8));
      const below = vh - a.bottom - gap - 8;
      const above = a.top - gap - 8;
      const menuH = menuRef.current?.scrollHeight ?? 320;
      const flip = below < Math.min(menuH, 260) && above > below;
      const maxHeight = Math.max(160, flip ? above : below);
      const top = flip ? Math.max(8, a.top - gap - Math.min(menuH, maxHeight)) : a.bottom + gap;
      setPos({ top, left, maxHeight });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, anchorRef, width]);

  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Node;
      if (menuRef.current?.contains(t) || anchorRef.current?.contains(t)) return;
      onClose();
    };
    const key = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("mousedown", down);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("mousedown", down);
      document.removeEventListener("keydown", key);
    };
  }, [open, onClose, anchorRef]);

  if (!open || typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: "fixed",
        top: pos?.top ?? -9999,
        left: pos?.left ?? -9999,
        width,
        maxHeight: pos?.maxHeight,
        visibility: pos ? "visible" : "hidden",
      }}
      className={cn(
        "z-[100] overflow-y-auto rounded-xl border bg-card p-1.5 text-card-foreground shadow-2xl scrollbar-slim animate-in fade-in-0 zoom-in-95",
        className,
      )}
    >
      {children}
    </div>,
    document.body,
  );
}
