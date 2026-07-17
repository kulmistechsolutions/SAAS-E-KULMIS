"use client";

import { use, useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLibraryPortalAuth } from "@/lib/library-portal/use-library-portal-auth";
import {
  apiLibraryPortalBook,
  fetchLibraryPortalBookFile,
  type LibraryPortalBookDetail,
} from "@/lib/library-portal/api";
import { ApiError } from "@/lib/api";

/**
 * The PDF is rendered to a <canvas> (via pdf.js) rather than shown in an
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
  const [pageNum, setPageNum] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [rendering, setRendering] = useState(false);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pdfRef = useRef<import("pdfjs-dist").PDFDocumentProxy | null>(null);
  const blobRef = useRef<Blob | null>(null);

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
        blobRef.current = blob;
        pdfRef.current = doc;
        setBook(meta);
        setNumPages(doc.numPages);
        setPageNum(1);
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

  const renderPage = useCallback(
    async (n: number) => {
      const pdf = pdfRef.current;
      const canvas = canvasRef.current;
      if (!pdf || !canvas) return;
      setRendering(true);
      try {
        const page = await pdf.getPage(n);
        const viewport = page.getViewport({ scale: 1.4 });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        await page.render({ canvasContext: ctx, viewport }).promise;

        // Watermark: identifies who a leaked screenshot/photo came from.
        if (me) {
          const label = `${me.student.fullName} · ${me.student.code} · ${new Date().toLocaleDateString()}`;
          ctx.save();
          ctx.globalAlpha = 0.12;
          ctx.fillStyle = "#000000";
          ctx.font = `${Math.max(14, viewport.width * 0.022)}px sans-serif`;
          ctx.translate(viewport.width / 2, viewport.height / 2);
          ctx.rotate(-Math.PI / 6);
          const stepY = Math.max(90, viewport.height / 6);
          for (let y = -viewport.height; y < viewport.height; y += stepY) {
            ctx.fillText(label, -viewport.width / 2, y);
          }
          ctx.restore();
        }
      } finally {
        setRendering(false);
      }
    },
    [me],
  );

  useEffect(() => {
    if (numPages > 0) void renderPage(pageNum);
  }, [pageNum, numPages, renderPage]);

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

  return (
    <div
      className="flex min-h-screen flex-col bg-slate-900"
      // Reduce casual copy/right-click; a determined reader can still get
      // around this, but it's not meant to stop them — see file header.
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="flex items-center justify-between gap-3 border-b border-white/10 bg-slate-950 px-4 py-2.5">
        <div className="min-w-0">
          <p className="truncate text-sm font-medium text-white">
            {book?.title ?? "Loading…"}
          </p>
          {numPages > 0 && (
            <p className="text-xs text-slate-400">
              Page {pageNum} of {numPages}
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

      <main className="flex flex-1 items-center justify-center overflow-auto p-4">
        {loading ? (
          <div className="flex items-center gap-2 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" /> Opening book…
          </div>
        ) : error ? (
          <div className="max-w-sm text-center text-slate-300">
            <AlertTriangle className="mx-auto mb-2 h-7 w-7 text-amber-400" />
            <p>{error}</p>
          </div>
        ) : (
          <div className="relative">
            {rendering && (
              <div className="absolute inset-0 flex items-center justify-center bg-slate-900/40">
                <Loader2 className="h-5 w-5 animate-spin text-white" />
              </div>
            )}
            <canvas
              ref={canvasRef}
              className="max-w-full rounded shadow-2xl"
            />
          </div>
        )}
      </main>

      {numPages > 1 && (
        <footer className="flex items-center justify-center gap-4 border-t border-white/10 bg-slate-950 px-4 py-3">
          <Button
            variant="outline"
            className="h-9 border-white/20 bg-transparent px-3 text-white hover:bg-white/10"
            onClick={() => setPageNum((p) => Math.max(1, p - 1))}
            disabled={pageNum <= 1 || rendering}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm text-slate-300">
            {pageNum} / {numPages}
          </span>
          <Button
            variant="outline"
            className="h-9 border-white/20 bg-transparent px-3 text-white hover:bg-white/10"
            onClick={() => setPageNum((p) => Math.min(numPages, p + 1))}
            disabled={pageNum >= numPages || rendering}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </footer>
      )}
    </div>
  );
}
