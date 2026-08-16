"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  ChevronDown,
  ChevronUp,
  Copy,
  Image as ImageIcon,
  Minus,
  PenLine,
  QrCode,
  RotateCcw,
  Square,
  Trash2,
  Type,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  FIELD_KEYS,
  FIELD_LABELS,
  clampElement,
  elementLabel,
  newElementId,
  renderDesign,
  type CardDesign,
  type CardElement,
  type ElementType,
  type FieldKey,
} from "@/lib/id-cards/elements";
import type { CardContext } from "@/lib/id-cards/types";

const MM = 96 / 25.4;
/** Positions snap to this many millimetres, so items line up exactly. */
const SNAP = 0.5;

const snap = (v: number) => Math.round(v / SNAP) * SNAP;
const round1 = (v: number) => Math.round(v * 10) / 10;

interface Props {
  design: CardDesign;
  ctx: CardContext;
  /**
   * Receives an updater, not a value. Two edits landing in the same tick (add
   * Text then add Signature) would otherwise both derive from the same stale
   * design and the first would be silently discarded.
   */
  onChange: (updater: (prev: CardDesign) => CardDesign) => void;
  onReset: () => void;
}

type DragState =
  | { mode: "move"; id: string; startX: number; startY: number; ox: number; oy: number }
  | { mode: "resize"; id: string; startX: number; startY: number; ow: number; oh: number }
  | null;

export function CardDesigner({ design, ctx, onChange, onReset }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [scale, setScale] = useState(0);
  const wrapRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);

  // Fit the canvas to whatever width the panel gives us.
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const measure = () => {
      const avail = el.getBoundingClientRect().width;
      setScale(Math.min(3.4, avail / (design.width * MM)));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [design.width]);

  const selected = design.elements.find((e) => e.id === selectedId) ?? null;

  const update = useCallback(
    (id: string, patch: Partial<CardElement>) => {
      onChange((d) => ({
        ...d,
        elements: d.elements.map((e) => (e.id === id ? clampElement({ ...e, ...patch }, d) : e)),
      }));
    },
    [onChange],
  );

  // ── Dragging ──
  useEffect(() => {
    if (scale <= 0) return;
    const perMm = MM * scale;

    const onMove = (ev: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      ev.preventDefault();
      const dx = (ev.clientX - d.startX) / perMm;
      const dy = (ev.clientY - d.startY) / perMm;
      if (d.mode === "move") {
        update(d.id, { x: snap(d.ox + dx), y: snap(d.oy + dy) });
      } else {
        update(d.id, { w: Math.max(2, snap(d.ow + dx)), h: Math.max(2, snap(d.oh + dy)) });
      }
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [scale, update]);

  // Arrow keys nudge the selection — finer control than a mouse gives.
  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if (!selected) return;
      const t = ev.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      const step = ev.shiftKey ? 2 : SNAP;
      const map: Record<string, [number, number]> = {
        ArrowLeft: [-step, 0], ArrowRight: [step, 0],
        ArrowUp: [0, -step], ArrowDown: [0, step],
      };
      const delta = map[ev.key];
      if (delta) {
        ev.preventDefault();
        update(selected.id, { x: selected.x + delta[0], y: selected.y + delta[1] });
      } else if (ev.key === "Delete" || ev.key === "Backspace") {
        ev.preventDefault();
        removeEl(selected.id);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, update]);

  function addEl(type: ElementType) {
    const base: CardElement = {
      id: newElementId(type),
      type,
      x: snap(design.width / 2 - 12),
      y: snap(design.height / 2 - 4),
      w: 24,
      h: 6,
    };
    const presets: Partial<Record<ElementType, Partial<CardElement>>> = {
      text: { text: "New text", fontSize: 5, color: "#0f172a", align: "left" },
      field: { field: "studentName", fontSize: 6, bold: true, color: "accentDark" },
      photo: { w: 20, h: 24, radius: 1.2, borderWidth: 0.4, borderColor: "accent" },
      logo: { w: 9, h: 9 },
      qr: { w: 10, h: 10 },
      signature: { w: 24, h: 7, fontSize: 3.8, color: "#64748b", align: "center", text: "" },
      box: { w: 26, h: 8, bg: "accent", radius: 1 },
      line: { w: 26, h: 0.3, borderColor: "#94a3b8" },
    };
    const el = clampElement({ ...base, ...(presets[type] ?? {}) }, design);
    onChange((d) => ({ ...d, elements: [...d.elements, el] }));
    setSelectedId(el.id);
  }

  function removeEl(elId: string) {
    onChange((d) => ({ ...d, elements: d.elements.filter((e) => e.id !== elId) }));
    setSelectedId(null);
  }

  function duplicateEl(elId: string) {
    const src = design.elements.find((e) => e.id === elId);
    if (!src) return;
    const copy = clampElement(
      { ...src, id: newElementId(src.type), x: src.x + 2, y: src.y + 2 },
      design,
    );
    onChange((d) => ({ ...d, elements: [...d.elements, copy] }));
    setSelectedId(copy.id);
  }

  function reorder(elId: string, dir: 1 | -1) {
    onChange((d) => {
      const i = d.elements.findIndex((e) => e.id === elId);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= d.elements.length) return d;
      const next = [...d.elements];
      [next[i], next[j]] = [next[j], next[i]];
      return { ...d, elements: next };
    });
  }

  const cw = design.width * MM * scale;
  const ch = design.height * MM * scale;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
      {/* ── Canvas ── */}
      <div>
        <div className="mb-2 flex flex-wrap items-center gap-1.5">
          <ToolBtn icon={Type} label="Text" onClick={() => addEl("text")} />
          <ToolBtn icon={User} label="Field" onClick={() => addEl("field")} />
          <ToolBtn icon={PenLine} label="Signature" onClick={() => addEl("signature")} />
          <ToolBtn icon={ImageIcon} label="Photo" onClick={() => addEl("photo")} />
          <ToolBtn icon={QrCode} label="QR" onClick={() => addEl("qr")} />
          <ToolBtn icon={Square} label="Box" onClick={() => addEl("box")} />
          <ToolBtn icon={Minus} label="Line" onClick={() => addEl("line")} />
          <button
            type="button"
            onClick={onReset}
            className="ms-auto inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs text-muted-foreground hover:bg-secondary/50"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Reset design
          </button>
        </div>

        <div ref={wrapRef} className="w-full">
          <div
            className="relative mx-auto select-none rounded-lg ring-1 ring-border"
            style={{ width: cw, height: ch, visibility: scale > 0 ? "visible" : "hidden" }}
            onMouseDown={() => setSelectedId(null)}
          >
            {/* The real card, drawn by the shared renderer. The `idc` class is
                what the print stylesheet targets, so the canvas and the printed
                card size their borders identically. */}
            <div
              className="idc pointer-events-none absolute left-0 top-0 origin-top-left overflow-hidden bg-white"
              style={{
                width: `${design.width}mm`,
                height: `${design.height}mm`,
                transform: `scale(${scale})`,
              }}
              dangerouslySetInnerHTML={{ __html: renderDesign(design, ctx) }}
            />

            {/* Hit areas, one per element, in the same coordinate space. */}
            {design.elements.map((el) => {
              const on = el.id === selectedId;
              return (
                <div
                  key={el.id}
                  onMouseDown={(ev) => {
                    ev.stopPropagation();
                    setSelectedId(el.id);
                    dragRef.current = {
                      mode: "move", id: el.id,
                      startX: ev.clientX, startY: ev.clientY, ox: el.x, oy: el.y,
                    };
                  }}
                  className={cn(
                    "absolute cursor-move",
                    on ? "ring-2 ring-primary" : "hover:ring-1 hover:ring-primary/40",
                  )}
                  style={{
                    left: el.x * MM * scale,
                    top: el.y * MM * scale,
                    width: el.w * MM * scale,
                    height: el.h * MM * scale,
                  }}
                >
                  {on && (
                    <span
                      onMouseDown={(ev) => {
                        ev.stopPropagation();
                        dragRef.current = {
                          mode: "resize", id: el.id,
                          startX: ev.clientX, startY: ev.clientY, ow: el.w, oh: el.h,
                        };
                      }}
                      className="absolute -bottom-1 -right-1 h-2.5 w-2.5 cursor-nwse-resize rounded-sm border border-white bg-primary"
                    />
                  )}
                </div>
              );
            })}
          </div>
        </div>
        <p className="mt-2 text-center text-xs text-muted-foreground">
          Drag to move · corner to resize · arrow keys to nudge · Delete to remove
        </p>
      </div>

      {/* ── Properties ── */}
      <div className="rounded-xl border bg-secondary/20 p-3">
        {!selected ? (
          <p className="py-8 text-center text-xs text-muted-foreground">
            Select an item on the card to edit it.
          </p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold">{elementLabel(selected)}</span>
              <div className="flex gap-1">
                <IconBtn title="Bring forward" onClick={() => reorder(selected.id, 1)}><ChevronUp className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="Send back" onClick={() => reorder(selected.id, -1)}><ChevronDown className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="Duplicate" onClick={() => duplicateEl(selected.id)}><Copy className="h-3.5 w-3.5" /></IconBtn>
                <IconBtn title="Delete" danger onClick={() => removeEl(selected.id)}><Trash2 className="h-3.5 w-3.5" /></IconBtn>
              </div>
            </div>

            {selected.type === "field" && (
              <div>
                <Label>Shows</Label>
                <Select
                  value={selected.field ?? "studentName"}
                  onChange={(e) => update(selected.id, { field: e.target.value as FieldKey })}
                >
                  {FIELD_KEYS.map((k) => (
                    <option key={k} value={k}>{FIELD_LABELS[k]}</option>
                  ))}
                </Select>
                {selected.field === "studentId" && (
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Value comes from the student record and cannot be edited here.
                  </p>
                )}
              </div>
            )}

            {(selected.type === "text" || selected.type === "signature") && (
              <div>
                <Label>{selected.type === "signature" ? "Officer name" : "Text"}</Label>
                <Input
                  value={selected.text ?? ""}
                  placeholder={selected.type === "signature" ? "Principal / Exam Officer" : "Type here"}
                  onChange={(e) => update(selected.id, { text: e.target.value })}
                />
              </div>
            )}

            {selected.type !== "box" && selected.type !== "line" && selected.type !== "photo" &&
              selected.type !== "qr" && selected.type !== "logo" && (
              <>
                <div className="grid grid-cols-2 gap-2">
                  <Num label="Size (pt)" step={0.2} value={selected.fontSize ?? 5}
                    onChange={(v) => update(selected.id, { fontSize: v })} />
                  <div>
                    <Label>Colour</Label>
                    <ColorField
                      value={selected.color ?? "#0f172a"}
                      accent={design.accent}
                      onChange={(v) => update(selected.id, { color: v })}
                    />
                  </div>
                </div>
                <div className="flex gap-1">
                  {([["left", AlignLeft], ["center", AlignCenter], ["right", AlignRight]] as const).map(
                    ([a, Icon]) => (
                      <IconBtn
                        key={a}
                        title={a}
                        active={(selected.align ?? "left") === a}
                        onClick={() => update(selected.id, { align: a })}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </IconBtn>
                    ),
                  )}
                  <IconBtn
                    title="Bold"
                    active={!!selected.bold}
                    onClick={() => update(selected.id, { bold: !selected.bold })}
                  >
                    <Bold className="h-3.5 w-3.5" />
                  </IconBtn>
                  <IconBtn
                    title="UPPERCASE"
                    active={!!selected.uppercase}
                    onClick={() => update(selected.id, { uppercase: !selected.uppercase })}
                  >
                    <span className="text-[10px] font-bold">AA</span>
                  </IconBtn>
                </div>
              </>
            )}

            {(selected.type === "box" || selected.type === "line") && (
              <div>
                <Label>{selected.type === "line" ? "Line colour" : "Fill"}</Label>
                <ColorField
                  value={(selected.type === "line" ? selected.borderColor : selected.bg) ?? "#e2e8f0"}
                  accent={design.accent}
                  onChange={(v) =>
                    update(selected.id, selected.type === "line" ? { borderColor: v } : { bg: v })
                  }
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-2">
              <Num label="X (mm)" value={round1(selected.x)} onChange={(v) => update(selected.id, { x: v })} />
              <Num label="Y (mm)" value={round1(selected.y)} onChange={(v) => update(selected.id, { y: v })} />
              <Num label="W (mm)" value={round1(selected.w)} onChange={(v) => update(selected.id, { w: v })} />
              <Num label="H (mm)" value={round1(selected.h)} onChange={(v) => update(selected.id, { h: v })} />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <MiniBtn onClick={() => update(selected.id, { x: snap((design.width - selected.w) / 2) })}>
                Centre across
              </MiniBtn>
              <MiniBtn onClick={() => update(selected.id, { x: 3 })}>Snap left</MiniBtn>
              <MiniBtn onClick={() => update(selected.id, { x: snap(design.width - selected.w - 3) })}>
                Snap right
              </MiniBtn>
              <MiniBtn onClick={() => update(selected.id, { w: snap(design.width - selected.x * 2) })}>
                Fit width
              </MiniBtn>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Small controls ────────────────────────────────────────────────────────

function ToolBtn({
  icon: Icon, label, onClick,
}: { icon: typeof Type; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-medium hover:border-primary/50 hover:bg-primary/5"
    >
      <Icon className="h-3.5 w-3.5" /> {label}
    </button>
  );
}

function IconBtn({
  children, onClick, title, active, danger,
}: {
  children: React.ReactNode; onClick: () => void; title: string;
  active?: boolean; danger?: boolean;
}) {
  return (
    <button
      type="button"
      title={title}
      onClick={onClick}
      className={cn(
        "inline-flex h-6 w-6 items-center justify-center rounded border transition",
        active && "border-primary bg-primary/10 text-primary",
        danger && "hover:border-rose-400 hover:bg-rose-500/10 hover:text-rose-600",
        !active && !danger && "hover:bg-secondary",
      )}
    >
      {children}
    </button>
  );
}

function MiniBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded border px-1.5 py-0.5 text-[11px] text-muted-foreground hover:bg-secondary"
    >
      {children}
    </button>
  );
}

function Num({
  label, value, onChange, step = 0.5,
}: { label: string; value: number; onChange: (v: number) => void; step?: number }) {
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="number"
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) || 0)}
      />
    </div>
  );
}

/** Colour picker that also offers the two brand tokens. */
function ColorField({
  value, accent, onChange,
}: { value: string; accent: string; onChange: (v: string) => void }) {
  const isToken = value === "accent" || value === "accentDark";
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        value={isToken ? accent : value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-10 cursor-pointer rounded border bg-background p-0.5"
      />
      <Select value={isToken ? value : "custom"} onChange={(e) => {
        const v = e.target.value;
        if (v !== "custom") onChange(v);
      }}>
        <option value="custom">Custom</option>
        <option value="accent">Brand</option>
        <option value="accentDark">Brand dark</option>
      </Select>
    </div>
  );
}
