"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Crop, ImagePlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  removeHeaderImage,
  updateSettingsSection,
  uploadHeaderImage,
  useSettingsState,
} from "@/lib/settings/store";
import { toast } from "@/lib/toast";

/**
 * The school's own letterhead banner.
 *
 * Schools arrive with a designed header — crest, name in two languages, town
 * — and want it on their invoices and documents exactly as designed, rather
 * than the header the system builds from the logo and name. They upload the
 * picture, crop away whatever margin came with the scan or screenshot, and
 * choose how tall it prints; every printout then carries it full width.
 *
 * The crop happens here, in the browser, so what is stored is exactly what
 * prints and the server never has to guess at a picture's edges.
 */

/** Printable width of an A4 page with the margins every document uses. */
const PRINT_WIDTH_MM = 190;
const MIN_MM = 12;
const MAX_MM = 90;
const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}
type Handle = "move" | "n" | "s" | "e" | "w" | "nw" | "ne" | "sw" | "se";

export function HeaderBannerCard() {
  const settings = useSettingsState();
  const school = settings.school;
  const [busy, setBusy] = useState(false);
  const [source, setSource] = useState<{ url: string; type: string } | null>(null);
  const [height, setHeight] = useState(school.headerImageHeightMm);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => setHeight(school.headerImageHeightMm), [school.headerImageHeightMm]);

  async function saveSchool(patch: Partial<typeof school>) {
    const res = await updateSettingsSection("school", { ...school, ...patch });
    if (!res.ok) toast(res.error ?? "Could not save.", "error");
    return res.ok;
  }

  function pickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(f.type)) {
      toast("Use a PNG, JPG or WebP picture.", "error");
      return;
    }
    setSource({ url: URL.createObjectURL(f), type: f.type });
  }

  async function onCropped(dataUrl: string, mime: string) {
    setBusy(true);
    const res = await uploadHeaderImage(dataUrl.split(",")[1] ?? "", mime);
    setBusy(false);
    if (!res.ok) {
      toast(res.error ?? "Upload failed.", "error");
      return;
    }
    toast("Header saved. Every printed document now uses it.", "success");
    if (source) URL.revokeObjectURL(source.url);
    setSource(null);
  }

  async function remove() {
    setBusy(true);
    const res = await removeHeaderImage();
    setBusy(false);
    toast(res.ok ? "Header removed." : (res.error ?? "Failed."), res.ok ? "success" : "error");
  }

  const url = school.headerImageUrl;

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">Document header (letterhead)</h2>
          <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
            Upload your school&apos;s own header picture. It prints across the top
            of invoices, receipts, reports and every other document, in place of
            the header built from your logo and name. Crop it and set its height
            to fit the paper.
          </p>
        </div>
        <div className="flex gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={pickFile}
          />
          <Button onClick={() => fileRef.current?.click()} disabled={busy}>
            <ImagePlus className="me-2 h-4 w-4" />
            {url ? "Replace" : "Upload header"}
          </Button>
          {url && (
            <Button variant="outline" className="text-rose-600" onClick={remove} disabled={busy}>
              <Trash2 className="me-2 h-4 w-4" />
              Remove
            </Button>
          )}
        </div>
      </div>

      {url ? (
        <div className="grid gap-5 lg:grid-cols-[1fr_260px]">
          <div className="space-y-4">
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={school.headerImageEnabled}
                onChange={(e) => void saveSchool({ headerImageEnabled: e.target.checked })}
              />
              Use this header on printed documents
            </label>
            <div>
              <Label>Height on paper: {height} mm</Label>
              <input
                type="range"
                min={MIN_MM}
                max={MAX_MM}
                value={height}
                onChange={(e) => setHeight(Number(e.target.value))}
                onPointerUp={() => void saveSchool({ headerImageHeightMm: height })}
                onKeyUp={() => void saveSchool({ headerImageHeightMm: height })}
                className="mt-2 w-full accent-primary"
              />
              <p className="mt-1 text-xs text-muted-foreground">
                The picture keeps its proportions; if it is wider than the page at
                this height, it is shown smaller rather than cut.
              </p>
            </div>
            <div className="rounded-xl border bg-muted/30 p-3">
              <p className="mb-2 text-xs font-medium text-muted-foreground">Current header</p>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="max-h-40 w-full object-contain" />
            </div>
          </div>
          <PaperPreview url={url} heightMm={height} enabled={school.headerImageEnabled} />
        </div>
      ) : (
        <p className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          No header uploaded. Documents use the header built from your logo and
          school name.
        </p>
      )}

      {source && (
        <CropDialog
          src={source.url}
          type={source.type}
          busy={busy}
          onCancel={() => {
            URL.revokeObjectURL(source.url);
            setSource(null);
          }}
          onDone={onCropped}
        />
      )}
    </section>
  );
}

/** An A4 page, to scale, with the header as it will print. */
function PaperPreview({ url, heightMm, enabled }: { url: string; heightMm: number; enabled: boolean }) {
  const pageW = 240;
  const scale = pageW / 210;
  return (
    <div>
      <p className="mb-2 text-xs font-medium text-muted-foreground">On A4 paper</p>
      <div
        className="relative mx-auto bg-white shadow ring-1 ring-black/10"
        style={{ width: pageW, height: 297 * scale, padding: 10 * scale }}
      >
        {enabled ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt=""
            style={{ width: PRINT_WIDTH_MM * scale, height: heightMm * scale, objectFit: "contain" }}
          />
        ) : (
          <div className="text-center text-[9px] text-slate-400" style={{ height: 22 * scale }}>
            (generated header)
          </div>
        )}
        <div className="mt-2 space-y-1.5">
          <div className="h-3 rounded bg-blue-700/80" />
          {Array.from({ length: 14 }, (_, i) => (
            <div key={i} className="h-1.5 rounded bg-slate-200" style={{ width: `${70 + ((i * 17) % 30)}%` }} />
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * Crop a picture by dragging a box over it. The box moves when dragged from
 * inside and resizes from its corners and edges. Output is cut from the
 * original pixels, so cropping never blurs the header.
 */
function CropDialog({
  src,
  type,
  busy,
  onCancel,
  onDone,
}: {
  src: string;
  type: string;
  busy: boolean;
  onCancel: () => void;
  onDone: (dataUrl: string, mime: string) => void;
}) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [crop, setCrop] = useState<Rect | null>(null);
  const drag = useRef<{ handle: Handle; startX: number; startY: number; start: Rect } | null>(null);

  const onLoad = () => {
    const img = imgRef.current!;
    const n = { w: img.naturalWidth, h: img.naturalHeight };
    setNatural(n);
    setCrop({ x: 0, y: 0, w: n.w, h: n.h });
  };

  /** Screen pixels per image pixel. */
  const scale = useCallback(() => {
    const img = imgRef.current;
    return img && natural ? img.clientWidth / natural.w : 1;
  }, [natural]);

  function begin(handle: Handle, e: React.PointerEvent) {
    if (!crop) return;
    e.preventDefault();
    e.stopPropagation();
    (e.target as Element).setPointerCapture(e.pointerId);
    drag.current = { handle, startX: e.clientX, startY: e.clientY, start: crop };
  }

  function move(e: React.PointerEvent) {
    const d = drag.current;
    if (!d || !natural) return;
    const k = scale();
    const dx = (e.clientX - d.startX) / k;
    const dy = (e.clientY - d.startY) / k;
    const s = d.start;
    const min = 20;
    let { x, y, w, h } = s;
    if (d.handle === "move") {
      x = Math.min(Math.max(0, s.x + dx), natural.w - s.w);
      y = Math.min(Math.max(0, s.y + dy), natural.h - s.h);
    } else {
      if (d.handle.includes("w")) {
        x = Math.min(Math.max(0, s.x + dx), s.x + s.w - min);
        w = s.x + s.w - x;
      }
      if (d.handle.includes("e")) w = Math.min(Math.max(min, s.w + dx), natural.w - s.x);
      if (d.handle.includes("n")) {
        y = Math.min(Math.max(0, s.y + dy), s.y + s.h - min);
        h = s.y + s.h - y;
      }
      if (d.handle.includes("s")) h = Math.min(Math.max(min, s.h + dy), natural.h - s.y);
    }
    setCrop({ x, y, w, h });
  }

  function end() {
    drag.current = null;
  }

  function apply() {
    if (!crop || !imgRef.current) return;
    // Keep the original resolution, capped at what a printer can use.
    const out = Math.min(1, 2400 / crop.w);
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(crop.w * out);
    canvas.height = Math.round(crop.h * out);
    const ctx = canvas.getContext("2d")!;
    const mime = type === "image/png" ? "image/png" : "image/jpeg";
    if (mime === "image/jpeg") {
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
    ctx.drawImage(imgRef.current, crop.x, crop.y, crop.w, crop.h, 0, 0, canvas.width, canvas.height);
    let dataUrl = canvas.toDataURL(mime, 0.92);
    // A large PNG photo can exceed the upload limit; JPEG it down if so.
    if (dataUrl.length * 0.75 > MAX_UPLOAD_BYTES) {
      dataUrl = canvas.toDataURL("image/jpeg", 0.85);
      onDone(dataUrl, "image/jpeg");
      return;
    }
    onDone(dataUrl, mime);
  }

  const k = scale();
  const box = crop
    ? { left: crop.x * k, top: crop.y * k, width: crop.w * k, height: crop.h * k }
    : null;
  const handles: Handle[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
  const pos: Record<string, React.CSSProperties> = {
    nw: { left: -6, top: -6, cursor: "nwse-resize" },
    n: { left: "50%", top: -6, marginLeft: -6, cursor: "ns-resize" },
    ne: { right: -6, top: -6, cursor: "nesw-resize" },
    e: { right: -6, top: "50%", marginTop: -6, cursor: "ew-resize" },
    se: { right: -6, bottom: -6, cursor: "nwse-resize" },
    s: { left: "50%", bottom: -6, marginLeft: -6, cursor: "ns-resize" },
    sw: { left: -6, bottom: -6, cursor: "nesw-resize" },
    w: { left: -6, top: "50%", marginTop: -6, cursor: "ew-resize" },
  };

  return (
    <Dialog
      open
      onClose={onCancel}
      title="Crop the header"
      className="max-w-4xl"
      footer={
        <>
          <Button
            variant="outline"
            onClick={() => natural && setCrop({ x: 0, y: 0, w: natural.w, h: natural.h })}
          >
            Whole picture
          </Button>
          <Button variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button onClick={apply} disabled={!crop || busy}>
            <Crop className="me-2 h-4 w-4" />
            {busy ? "Saving…" : "Crop & save"}
          </Button>
        </>
      }
    >
      <p className="mb-3 text-sm text-muted-foreground">
        Drag the box to choose the part to keep. Pull its corners or sides to
        resize it.
      </p>
      <div
        className="relative mx-auto w-full select-none touch-none"
        onPointerMove={move}
        onPointerUp={end}
        onPointerCancel={end}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt="" onLoad={onLoad} className="block w-full" draggable={false} />
        {box && (
          <>
            {/* Shade what is cut away. */}
            <div className="pointer-events-none absolute inset-0 bg-black/45"
              style={{ clipPath: `polygon(0 0,100% 0,100% 100%,0 100%,0 0,${box.left}px ${box.top}px,${box.left}px ${box.top + box.height}px,${box.left + box.width}px ${box.top + box.height}px,${box.left + box.width}px ${box.top}px,${box.left}px ${box.top}px)` }}
            />
            <div
              className="absolute cursor-move border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,.5)]"
              style={box}
              onPointerDown={(e) => begin("move", e)}
            >
              {handles.map((h) => (
                <span
                  key={h}
                  className="absolute h-3 w-3 rounded-sm border border-slate-700 bg-white"
                  style={pos[h]}
                  onPointerDown={(e) => begin(h, e)}
                />
              ))}
            </div>
          </>
        )}
      </div>
      {crop && (
        <p className="mt-2 text-center text-xs text-muted-foreground">
          {Math.round(crop.w)} × {Math.round(crop.h)} px
        </p>
      )}
    </Dialog>
  );
}
