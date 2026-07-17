import { BadRequestException } from "@nestjs/common";

/**
 * Library books are real PDFs, so they're uploaded as multipart rather than the
 * base64-in-JSON pattern used for logos/photos — a 50 MB file would be ~68 MB of
 * base64 and blow past the JSON body limit.
 */
export const LIBRARY_PDF_MAX_BYTES = 50 * 1024 * 1024;

export const LIBRARY_PDF_MIME_TYPES = ["application/pdf"] as const;

export type LibraryPdfMime = (typeof LIBRARY_PDF_MIME_TYPES)[number];

export function assertLibraryPdfMime(mime: string): LibraryPdfMime {
  if (!LIBRARY_PDF_MIME_TYPES.includes(mime as LibraryPdfMime)) {
    throw new BadRequestException("Only PDF files can be uploaded.");
  }
  return mime as LibraryPdfMime;
}

/** Keys are namespaced by tenant so one school can never read another's file. */
export function libraryDocumentKey(schoolId: string, documentId: string): string {
  return `${schoolId}/library/${documentId}.pdf`;
}

export function formatMb(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
