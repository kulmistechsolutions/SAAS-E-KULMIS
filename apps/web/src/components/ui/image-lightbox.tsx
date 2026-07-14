"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ImageLightboxProps {
  open: boolean;
  src: string;
  alt: string;
  onClose: () => void;
}

export function ImageLightbox({ open, src, alt, onClose }: ImageLightboxProps) {
  const [scale, setScale] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const lastPoint = useRef({ x: 0, y: 0 });

  const reset = useCallback(() => {
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, []);

  useEffect(() => {
    if (!open) return;
    reset();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose, reset]);

  if (!open) return null;

  function zoomBy(delta: number) {
    setScale((s) => Math.min(4, Math.max(0.5, Number((s + delta).toFixed(2)))));
  }

  function onWheel(e: React.WheelEvent) {
    e.preventDefault();
    zoomBy(e.deltaY < 0 ? 0.12 : -0.12);
  }

  function onPointerDown(e: React.PointerEvent) {
    if (scale <= 1) return;
    dragging.current = true;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!dragging.current) return;
    const dx = e.clientX - lastPoint.current.x;
    const dy = e.clientY - lastPoint.current.y;
    lastPoint.current = { x: e.clientX, y: e.clientY };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }

  function onPointerUp() {
    dragging.current = false;
  }

  return (
    <div
      className="fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={`Preview: ${alt}`}
    >
      <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
        <p className="truncate text-sm font-medium">{alt}</p>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => zoomBy(-0.2)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Zoom out"
          >
            <Minus className="h-4 w-4" />
          </button>
          <span className="min-w-[3rem] text-center text-xs tabular-nums">
            {Math.round(scale * 100)}%
          </span>
          <button
            type="button"
            onClick={() => zoomBy(0.2)}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Zoom in"
          >
            <Plus className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={reset}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Reset zoom"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-2 hover:bg-white/10"
            aria-label="Close preview"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      <button
        type="button"
        className="absolute inset-0 -z-10"
        onClick={onClose}
        aria-label="Close preview backdrop"
      />

      <div
        className={cn(
          "relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6",
          scale > 1 ? "cursor-grab active:cursor-grabbing" : "cursor-zoom-in",
        )}
        onWheel={onWheel}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => (scale > 1 ? reset() : setScale(2))}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt={alt}
          draggable={false}
          className="max-h-[calc(100vh-7rem)] max-w-full select-none rounded-lg object-contain shadow-2xl transition-transform duration-75"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
          }}
        />
      </div>
    </div>
  );
}
