"use client";


import { useT } from "@/lib/i18n/provider";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface PaginationProps {
  page: number;
  pageCount: number;
  total: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  /**
   * Given a handler, the bar offers how many rows to show at once.
   *
   * A list of thirteen pages is thirteen clicks to read, and reading the whole
   * thing is the usual reason someone opened it. Left off, the bar is exactly
   * what it was.
   */
  onPageSizeChange?: (size: number) => void;
}

/** The sizes offered. 1000 is the "show me everything" option in practice. */
const PAGE_SIZES = [10, 20, 50, 100, 1000];

export function Pagination({
  page,
  pageCount,
  total,
  pageSize,
  onPageChange,
  onPageSizeChange,
}: PaginationProps) {
  const t = useT();
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const pages = getPageWindow(page, pageCount);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 py-3 text-sm">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-muted-foreground">
          {t("uiPagination.showing")} <span className="font-medium text-foreground">{from}</span>–
          <span className="font-medium text-foreground">{to}</span> {t("uiPagination.of")}{" "}
          <span className="font-medium text-foreground">{total}</span>
        </p>
        {onPageSizeChange && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            {t("uiPagination.rowsPerPage")}
            <select
              value={pageSize}
              onChange={(e) => onPageSizeChange(Number(e.target.value))}
              className="h-8 rounded-lg border bg-background px-2 text-sm text-foreground outline-none transition-colors focus:border-primary"
            >
              {/* A size the caller set that is not on the list still shows, or
                  the box would display someone else's number. */}
              {(PAGE_SIZES.includes(pageSize)
                ? PAGE_SIZES
                : [...PAGE_SIZES, pageSize].sort((a, b) => a - b)
              ).map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </label>
        )}
      </div>
      <div className={cn("flex items-center gap-1", pageCount <= 1 && "hidden")}>
        <button
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        {pages.map((p, i) =>
          p === "..." ? (
            <span key={`e${i}`} className="px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <button
              key={p}
              onClick={() => onPageChange(p)}
              className={cn(
                "flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm font-medium transition-colors",
                p === page
                  ? "border-primary bg-primary text-primary-foreground"
                  : "text-foreground hover:bg-secondary",
              )}
            >
              {p}
            </button>
          ),
        )}
        <button
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pageCount}
          className="flex h-8 w-8 items-center justify-center rounded-lg border text-muted-foreground transition-colors hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

function getPageWindow(page: number, pageCount: number): (number | "...")[] {
  if (pageCount <= 7)
    return Array.from({ length: pageCount }, (_, i) => i + 1);
  const out: (number | "...")[] = [1];
  const start = Math.max(2, page - 1);
  const end = Math.min(pageCount - 1, page + 1);
  if (start > 2) out.push("...");
  for (let i = start; i <= end; i++) out.push(i);
  if (end < pageCount - 1) out.push("...");
  out.push(pageCount);
  return out;
}
