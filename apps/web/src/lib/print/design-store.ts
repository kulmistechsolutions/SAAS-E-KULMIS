"use client";

import { useSyncExternalStore } from "react";
import { api } from "@/lib/api";
import { docType, type DocTypeDef } from "@/lib/print/catalogue";
import type { PaperSize } from "@/lib/print/paper";

/**
 * Which design each kind of document prints in, for this school.
 *
 * One place every Print button in the system asks, so an administrator sets a
 * receipt design once and every receipt — collected today, reprinted from
 * history, or printed by a different clerk on a different machine — comes out
 * the same. The choice lives on the school record rather than in a browser, so
 * it does not quietly differ between the two computers in the office.
 *
 * Read synchronously. A print handler cannot await: it is called from a click
 * and a browser that is handed a promise instead of a window blocks the popup.
 * So the settings are loaded once and kept here, and a page that has not
 * loaded them yet prints the documented default rather than nothing.
 */

export interface DocDesignChoice {
  template: string;
  paper?: PaperSize;
  landscape?: boolean;
}

type PrintSettings = Record<string, DocDesignChoice>;

let settings: PrintSettings = {};
let loaded = false;
let inFlight: Promise<void> | null = null;
const listeners = new Set<() => void>();

/** A stable snapshot, so useSyncExternalStore does not loop. */
let snapshot: PrintSettings = settings;

function emit() {
  snapshot = { ...settings };
  for (const l of listeners) l();
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

interface SchoolRow {
  printSettings?: PrintSettings | null;
}

/** Load once per session; repeat calls share the one request. */
export function loadPrintSettings(): Promise<void> {
  if (loaded) return Promise.resolve();
  if (inFlight) return inFlight;
  inFlight = api<SchoolRow>("/settings")
    .then((row) => {
      settings = row.printSettings ?? {};
      loaded = true;
      emit();
    })
    .catch(() => {
      // A school that cannot be read prints its defaults. Refusing to print
      // because a preference could not be fetched would be the wrong trade.
      loaded = true;
    })
    .finally(() => {
      inFlight = null;
    });
  return inFlight;
}

/** Save one document type's design and keep the local copy in step. */
export async function savePrintDesign(
  documentType: string,
  choice: DocDesignChoice,
): Promise<void> {
  const next = { ...settings, [documentType]: choice };
  await api("/settings", { method: "PATCH", body: { printSettings: next } });
  settings = next;
  loaded = true;
  emit();
}

/** Put one document type back to what the system ships with. */
export async function resetPrintDesign(documentType: string): Promise<void> {
  const next = { ...settings };
  delete next[documentType];
  await api("/settings", { method: "PATCH", body: { printSettings: next } });
  settings = next;
  emit();
}

/**
 * The design to print a document in — the school's choice, or the default the
 * catalogue documents. Never returns nothing: a Print button always has an
 * answer.
 */
export function designFor(documentType: string): DocDesignChoice {
  const def: DocTypeDef | undefined = docType(documentType);
  const chosen = settings[documentType];
  if (chosen && def && def.templates.some((t) => t.id === chosen.template)) {
    return chosen;
  }
  // A template id that is no longer offered — an older choice, a renamed
  // design — falls back rather than printing a layout that does not exist.
  return {
    template: def?.defaultTemplate ?? "PREMIUM",
    paper: def?.defaultPaper ?? "A4",
    landscape: def?.defaultLandscape ?? false,
  };
}

/** Whether this school has chosen, as opposed to running on the default. */
export function isCustomised(documentType: string): boolean {
  return Boolean(settings[documentType]);
}

export function usePrintSettings(): PrintSettings {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => snapshot,
  );
}
