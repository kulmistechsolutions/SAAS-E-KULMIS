"use client";

import { useEffect, useState } from "react";
import { apiFetchStudentPhotoBlob } from "./api";

const blobCache = new Map<string, string>();

function isHttpUrl(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\//i.test(url);
}

/** Fetch a student photo via the authenticated API and return a blob URL. */
export async function fetchStudentPhotoUrl(
  studentId: string,
): Promise<string | null> {
  const cached = blobCache.get(studentId);
  if (cached) return cached;

  try {
    const blob = await apiFetchStudentPhotoBlob(studentId);
    const url = URL.createObjectURL(blob);
    blobCache.set(studentId, url);
    return url;
  } catch (err) {
    console.error(`[students] photo fetch failed for ${studentId}:`, err);
    return null;
  }
}

export function invalidateStudentPhoto(studentId: string): void {
  const existing = blobCache.get(studentId);
  if (existing) {
    URL.revokeObjectURL(existing);
    blobCache.delete(studentId);
  }
}

/**
 * Resolve the display URL for a student photo.
 * Prefer the API-provided Supabase public/signed URL; fall back to the
 * authenticated proxy when only hasPhoto is set (local/MinIO backends).
 */
export function useStudentPhoto(
  studentId: string | undefined,
  hasPhoto: boolean | undefined,
  photoUrl?: string | null,
  /** Local preview (blob/data URL) takes precedence over stored photos. */
  previewUrl?: string | null,
): string | null {
  const [url, setUrl] = useState<string | null>(() => {
    if (previewUrl) return previewUrl;
    if (isHttpUrl(photoUrl)) return photoUrl;
    return null;
  });

  useEffect(() => {
    if (previewUrl) {
      setUrl(previewUrl);
      return;
    }
    if (isHttpUrl(photoUrl)) {
      setUrl(photoUrl);
      return;
    }
    if (!studentId || !hasPhoto) {
      setUrl(null);
      return;
    }

    let active = true;
    void fetchStudentPhotoUrl(studentId).then((next) => {
      if (active) setUrl(next);
    });
    return () => {
      active = false;
    };
  }, [studentId, hasPhoto, photoUrl, previewUrl]);

  return url;
}
