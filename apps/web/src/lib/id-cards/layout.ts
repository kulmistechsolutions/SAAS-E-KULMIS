"use client";

import { CARD_SIZES, type CardOrientation, type PrintLayoutSettings } from "./types";

/** A4 in millimetres. Every measurement in this module is mm so it survives print. */
export const PAGE_A4 = { width: 210, height: 297 };

export interface ResolvedGrid {
  /** Card footprint on paper, in mm, after orientation is applied. */
  cardWidth: number;
  cardHeight: number;
  cols: number;
  rows: number;
  /** How many cards actually land on one page. */
  perPage: number;
  /** The most cards this paper/card/gap combination can physically hold. */
  capacity: number;
  /** True when the requested cards-per-page could not fit and was reduced. */
  clamped: boolean;
  gap: number;
  margin: number;
}

/**
 * Work out the card grid for one A4 page.
 *
 * The requested cards-per-page is a wish, not a promise: a card is an
 * indivisible print element (PRD §16), so if the requested count cannot fit at
 * the chosen size the grid is reduced to what the paper genuinely holds rather
 * than shrinking cards or letting one straddle a page break. `clamped` tells
 * the UI to say so out loud instead of silently printing something else.
 */
export function resolveGrid(layout: PrintLayoutSettings): ResolvedGrid {
  const base =
    layout.sizeId === "CUSTOM"
      ? { width: layout.customWidth, height: layout.customHeight }
      : (CARD_SIZES.find((s) => s.id === layout.sizeId) ?? CARD_SIZES[0]);

  // Sizes are defined landscape; portrait simply swaps the axes.
  const cardWidth = layout.orientation === "PORTRAIT" ? base.height : base.width;
  const cardHeight = layout.orientation === "PORTRAIT" ? base.width : base.height;

  const gap = Math.max(0, layout.gap);
  const margin = Math.max(0, layout.margin);
  const usableW = PAGE_A4.width - margin * 2;
  const usableH = PAGE_A4.height - margin * 2;

  // A row of n cards spans n*card + (n-1)*gap, so add one gap to both sides
  // of the division to avoid dropping a card that fits without a trailing gap.
  const maxCols = Math.max(1, Math.floor((usableW + gap) / (cardWidth + gap)));
  const maxRows = Math.max(1, Math.floor((usableH + gap) / (cardHeight + gap)));
  const capacity = maxCols * maxRows;

  const wanted = Math.max(1, Math.floor(layout.cardsPerPage));
  const perPageWanted = Math.min(wanted, capacity);

  // Prefer filling rows across the page before starting a new row.
  const cols = Math.min(maxCols, perPageWanted);
  const rows = Math.min(maxRows, Math.ceil(perPageWanted / cols));
  const perPage = Math.min(perPageWanted, cols * rows);

  return {
    cardWidth,
    cardHeight,
    cols,
    rows,
    perPage,
    capacity,
    clamped: perPage < wanted,
    gap,
    margin,
  };
}

/**
 * Split a flat list into pages of `perPage`. Pure chunking — this is what
 * guarantees automatic pagination (PRD §17) with no manual arrangement, and
 * why a card can never be half on one page and half on the next.
 */
export function paginate<T>(items: T[], perPage: number): T[][] {
  if (perPage < 1) return items.length ? [items] : [];
  const pages: T[][] = [];
  for (let i = 0; i < items.length; i += perPage) {
    pages.push(items.slice(i, i + perPage));
  }
  return pages;
}

/** Cards-per-page presets that actually fit, given the size and orientation. */
export function availablePerPageOptions(
  layout: PrintLayoutSettings,
  presets: number[] = [4, 6, 8, 9, 12],
): { value: number; fits: boolean }[] {
  const capacity = resolveGrid({ ...layout, cardsPerPage: 1 }).capacity;
  return presets.map((value) => ({ value, fits: value <= capacity }));
}

export function orientationLabel(o: CardOrientation): string {
  return o === "PORTRAIT" ? "Portrait" : "Landscape";
}
