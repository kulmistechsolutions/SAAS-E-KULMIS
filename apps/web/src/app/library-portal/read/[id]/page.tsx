"use client";

import {
  use,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Download, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibraryPortalAuth } from "@/lib/library-portal/use-library-portal-auth";
import {
  apiLibraryPortalBook,
  fetchLibraryPortalBookFile,
  type LibraryPortalBookDetail,
} from "@/lib/library-portal/api";
import { ApiError } from "@/lib/api";
import { cn } from "@/lib/utils";

type PdfDoc = import("pdfjs-dist").PDFDocumentProxy;

/** A book page's on-screen size before it has rendered, so the scroll list doesn't jump. */
interface PageSize {
  width: number;
  height: number;
}

function stampWatermark(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  label: string,
) {
  ctx.save();
  ctx.globalAlpha = 0.1;
  ctx.fillStyle = "#000000";
  ctx.font = `${Math.max(13, width * 0.02)}px sans-serif`;
  ctx.translate(width / 2, height / 2);
  ctx.rotate(-Math.PI / 6);
  const stepY = Math.max(80, height / 6);
  for (let y = -height; y < height; y += stepY) {
    ctx.fillText(label, -width / 2, y);
  }
  ctx.restore();
}

/**
 * One page in the continuous scroll. Renders lazily — only once it's near
 * the viewport — so a 200-page book doesn't render 200 canvases up front.
 */
function PdfPage({
  pdf,
  pageNumber,
  scale,
  size,
  watermarkLabel,
  rootRef,
  onVisible,
}: {
  pdf: PdfDoc;
  pageNumber: number;
  scale: number;
  size: PageSize;
  watermarkLabel: string;
  rootRef: React.RefObject<HTMLDivElement | null>;
  onVisible: (page: number) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rendered, setRendered] = useState(false);
  const [nearby, setNearby] = useState(false);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setNearby(true);
          if (entry.intersectionRatio >= 0.5) onVisible(pageNumber);
        }
      },
      { root: rootRef.current, rootMargin: "800px 0px", threshold: [0, 0.5] },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [pageNumber, rootRef, onVisible]);

  useEffect(() => {
    if (!nearby || rendered) return;
    let cancelled = false;
    (async () => {
      const page = await pdf.getPage(pageNumber);
      if (cancelled) return;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      if (!canvas) return;
      canvas.width = viewport.width;
      canvas.height = viewport.height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      await page.render({ canvasContext: ctx, viewport }).promise;
      if (cancelled) return;
      stampWatermark(ctx, viewport.width, viewport.height, watermarkLabel);
      setRendered(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [nearby, rendered, pdf, pageNumber, scale, watermarkLabel]);

  return (
    <div
      ref={wrapperRef}
      data-page={pageNumber}
      className="relative mx-auto mb-4 overflow-hidden rounded-md bg-white shadow-xl last:mb-0"
      style={{ width: size.width, height: size.height }}
    >
      {!rendered && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-slate-100 text-slate-400">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span className="text-xs">Page {pageNumber}</span>
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={cn(
          "block w-full transition-opacity duration-200",
          rendered ? "opacity-100" : "opacity-0",
        )}
      />
    </div>
  );
}

/**
 * The PDF is rendered to <canvas> pages (via pdf.js) rather than shown in an
 * <iframe>/<object> — that avoids ever exposing a plain, navigable URL to the
 * raw file, so there's no browser-native "Save As" on it. This is a
 * deterrent, not real DRM: nothing stops a photo of the screen. The
 * watermark exists so a leaked page is traceable back to the student.
 */
export default function LibraryPortalReadPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();
  const { me, loading: authLoading } = useLibraryPortalAuth();

  const [book, setBook] = useState<LibraryPortalBookDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [pageSize, setPageSize] = useState<PageSize | null>(null);
  const [scale, setScale] = useState(1);
  const [visiblePage, setVisiblePage] = useState(1);

  const scrollRef = useRef<HTMLDivElement>(null);
  const pdfRef = useRef<PdfDoc | null>(null);
  const blobRef = useRef<Blob | null>(null);
  const baseViewportRef = useRef<{ width: number; height: number } | null>(null);

  const watermarkLabel = useMemo(
    () =>
      me
        ? `${me.student.fullName} · ${me.student.code} · ${new Date().toLocaleDateString()}`
        : "",
    [me],
  );

  const fitToContainer = useCallback(() => {
    const base = baseViewportRef.current;
    const container = scrollRef.current;
    if (!base || !container) return;
    const available = Math.min(container.clientWidth - 32, 900);
    const nextScale = Math.max(0.4, available / base.width);
    setScale(nextScale);
    setPageSize({ width: base.width * nextScale, height: base.height * nextScale });
  }, []);

  // Load metadata + bytes once per book id.
  useEffect(() => {
    if (!me) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([
      apiLibraryPortalBook(id),
      fetchLibraryPortalBookFile(id),
      import("pdfjs-dist"),
    ])
      .then(async ([meta, blob, pdfjs]) => {
        if (cancelled) return;
        pdfjs.GlobalWorkerOptions.workerSrc = new URL(
          "pdfjs-dist/build/pdf.worker.min.mjs",
          import.meta.url,
        ).toString();
        const buf = await blob.arrayBuffer();
        const doc = await pdfjs.getDocument({ data: buf }).promise;
        if (cancelled) return;
        const firstPage = await doc.getPage(1);
        const base = firstPage.getViewport({ scale: 1 });
        baseViewportRef.current = { width: base.width, height: base.height };

        blobRef.current = blob;
        pdfRef.current = doc;
        setBook(meta);
        setNumPages(doc.numPages);
        setVisiblePage(1);
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e instanceof ApiError ? e.message : "Could not open this book.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [id, me]);

  // Fit the page width to the viewport once the doc is ready, and again on resize.
  useEffect(() => {
    if (!baseViewportRef.current || numPages === 0) return;
    fitToContainer();
    let t: ReturnType<typeof setTimeout>;
    const onResize = () => {
      clearTimeout(t);
      t = setTimeout(fitToContainer, 200);
    };
    window.addEventListener("resize", onResize);
    return () => {
      clearTimeout(t);
      window.removeEventListener("resize", onResize);
    };
  }, [numPages, fitToContainer]);

  function download() {
    if (!blobRef.current || !book) return;
    const url = URL.createObjectURL(blobRef.current);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${book.title}.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  if (authLoading || !me) {
    return (
      <div className="flex min-h-screen items-center justify-center gap-2 text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading…
      </div>
    );
  }

  const pdf = pdfRef.current;
  const ready = !loading && !error && pdf && pageSize;

  return (
    <div
      className="flex h-screen flex-col overflow-hidden bg-slate-900"
      // Reduce casual copy/right-click; a determined reader can still get
      // around this, but it's not meant to stop them — see file header.
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {book?.title ?? "Opening…"}
          </p>
          {numPages > 0 && (
            <p className="text-xs text-slate-400">
              Page {visiblePage} of {numPages}
            </p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {book?.allowDownload && (
            <Button
              variant="outline"
              className="h-8 border-white/20 bg-transparent px-3 text-xs text-white hover:bg-white/10"
              onClick={download}
            >
              <Download className="mr-1.5 h-3.5 w-3.5" /> Download
            </Button>
          )}
          <button
            type="button"
            onClick={() => router.push("/library-portal")}
            className="rounded-md p-1.5 text-slate-400 hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </header>

      <div ref={scrollRef} className="relative flex-1 overflow-y-auto scroll-smooth">
        {loading ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="h-6 w-6 animate-spin" />
            <p className="text-sm">Opening book…</p>
          </div>
        ) : error ? (
          <div className="flex h-full items-center justify-center px-4">
            <div className="max-w-sm text-center text-slate-300">
              <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-amber-400" />
              <p>{error}</p>
            </div>
          </div>
        ) : (
          ready && (
            <div className="px-4 py-6">
              {Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
                <PdfPage
                  key={n}
                  pdf={pdf}
                  pageNumber={n}
                  scale={scale}
                  size={pageSize}
                  watermarkLabel={watermarkLabel}
                  rootRef={scrollRef}
                  onVisible={setVisiblePage}
                />
              ))}
            </div>
          )
        )}
      </div>

      {ready && numPages > 1 && (
        <div className="pointer-events-none fixed bottom-4 left-1/2 z-10 -translate-x-1/2">
          <span className="rounded-full bg-slate-950/80 px-3 py-1 text-xs font-medium text-slate-200 shadow-lg backdrop-blur">
            {visiblePage} / {numPages}
          </span>
        </div>
      )}
    </div>
  );
}
