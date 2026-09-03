"use client";


import { useT } from "@/lib/i18n/provider";
import { useState } from "react";
import { Camera, Trash2, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { readStudentPhotoFile } from "@/lib/media/image";
import { useStudentPhoto } from "@/lib/students/photo";
import { cn } from "@/lib/utils";

interface StudentPhotoUploadProps {
  previewUrl: string | null;
  onPreviewChange: (url: string | null) => void;
  onFileChange: (file: File | null) => void;
  onRemoveExisting?: () => void;
  /** Load saved photo from API when editing an existing student. */
  studentId?: string;
  hasExistingPhoto?: boolean;
  /** Supabase URL from the API when editing. */
  existingPhotoUrl?: string | null;
  disabled?: boolean;
  className?: string;
  /** Horizontal layout for form header row */
  compact?: boolean;
  /** Hide helper text under photo (fits form without scroll) */
  minimal?: boolean;
}

export function StudentPhotoUpload({
  previewUrl,
  onPreviewChange,
  onFileChange,
  onRemoveExisting,
  studentId,
  hasExistingPhoto,
  existingPhotoUrl,
  disabled,
  className,
  compact = false,
  minimal = false,
}: StudentPhotoUploadProps) {
  const t = useT();
  const [error, setError] = useState<string | null>(null);
  const inputId = "student-photo-input";
  const savedPhotoUrl = useStudentPhoto(
    studentId,
    hasExistingPhoto,
    existingPhotoUrl,
    previewUrl,
  );
  const displayUrl = previewUrl ?? savedPhotoUrl;

  async function handleFile(file: File | null) {
    setError(null);
    if (!file) return;
    try {
      const { previewUrl: url } = await readStudentPhotoFile(file);
      onPreviewChange(url);
      onFileChange(file);
    } catch (e) {
      const message = e instanceof Error ? e.message : "Failed to load image.";
      setError(message);
      onPreviewChange(null);
      onFileChange(null);
    }
  }

  function clearPhoto() {
    setError(null);
    onPreviewChange(null);
    onFileChange(null);
    onRemoveExisting?.();
  }

  const size = compact ? "h-24 w-24" : "h-36 w-36";

  return (
    <div
      className={cn(
        compact
          ? "flex shrink-0 flex-col items-center sm:items-start"
          : "flex flex-col items-center",
        className,
      )}
    >
      <div className="relative">
        <div
          className={cn(
            "flex items-center justify-center overflow-hidden rounded-2xl border-2 border-dashed bg-background shadow-sm",
            size,
            previewUrl ? "border-primary/20" : "border-border",
          )}
        >
          {displayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={displayUrl}
              alt={t("studentsStudentPhotoUpload.studentPhotoPreview")}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex flex-col items-center gap-1.5 px-2 text-center text-muted-foreground">
              <User className="h-8 w-8 opacity-50" />
              <span className="text-[11px] leading-tight">{t("studentsStudentPhotoUpload.addPhoto")}</span>
            </div>
          )}
        </div>
        {!disabled && (
          <label
            htmlFor={inputId}
            className="absolute -bottom-1 -end-1 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border-2 border-background bg-primary text-primary-foreground shadow-md transition hover:opacity-90"
            title={t("studentsStudentPhotoUpload.choosePhoto")}
          >
            <Camera className="h-4 w-4" />
          </label>
        )}
        {/* Removing a photo has to be possible wherever one can be added.
            The text button below is hidden in the compact layout the edit
            dialog uses, which left the form able to replace a photo and never
            to clear one — a picture put on the wrong child could not be taken
            off. */}
        {displayUrl && !disabled && (
          <button
            type="button"
            onClick={clearPhoto}
            title={t("studentsStudentPhotoUpload.remove")}
            aria-label={t("studentsStudentPhotoUpload.remove")}
            className="absolute -top-1 -end-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-background bg-rose-600 text-white shadow-md transition hover:bg-rose-700"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      <input
        id={inputId}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        disabled={disabled}
        onChange={(e) => void handleFile(e.target.files?.[0] ?? null)}
      />

      {!minimal && (
        <p className="mt-2.5 max-w-[9rem] text-center text-[11px] leading-snug text-muted-foreground sm:text-start">
          {t("studentsStudentPhotoUpload.optionalJpegPngWebpMax2")}
        </p>
      )}

      {displayUrl && !disabled && !minimal ? (
        <Button
          type="button"
          variant="ghost"
          className="mt-1 h-8 px-2 text-xs text-rose-600 hover:text-rose-700"
          onClick={clearPhoto}
        >
          <Trash2 className="me-1.5 h-3.5 w-3.5" />
          {t("studentsStudentPhotoUpload.remove")}
        </Button>
      ) : null}

      {error ? (
        <p className="mt-2 max-w-[10rem] text-center text-xs text-rose-600 sm:text-start" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
