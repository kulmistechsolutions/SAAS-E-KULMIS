"use client";

import { api } from "@/lib/api";
import type { CardDesign, CardElement } from "./elements";

/**
 * Saved card layouts live on the server so every admin in a school sees the
 * same design. They used to sit in localStorage, which meant a layout drawn on
 * the office PC did not exist on anyone else's machine.
 */

export interface StoredCardDesign {
  designKey: string;
  styleId: string;
  orientation: string;
  accent: string;
  width: number;
  height: number;
  elements: CardElement[];
  updatedAt: string;
}

export async function apiListCardDesigns(): Promise<StoredCardDesign[]> {
  return api<StoredCardDesign[]>("/card-designs");
}

export async function apiSaveCardDesign(
  designKey: string,
  styleId: string,
  orientation: string,
  design: CardDesign,
): Promise<{ designKey: string }> {
  return api<{ designKey: string }>("/card-designs", {
    method: "POST",
    body: {
      designKey,
      styleId,
      orientation,
      accent: design.accent,
      width: design.width,
      height: design.height,
      elements: design.elements,
    },
  });
}

export async function apiDeleteCardDesign(designKey: string): Promise<{ removed: number }> {
  return api<{ removed: number }>(`/card-designs/${encodeURIComponent(designKey)}`, {
    method: "DELETE",
  });
}

/** Server rows → the shape the page keeps in state. */
export function toDesignMap(rows: StoredCardDesign[]): Record<string, CardDesign> {
  const out: Record<string, CardDesign> = {};
  for (const r of rows) {
    if (!r.width || !r.height || !Array.isArray(r.elements)) continue;
    out[r.designKey] = { width: r.width, height: r.height, accent: r.accent, elements: r.elements };
  }
  return out;
}
