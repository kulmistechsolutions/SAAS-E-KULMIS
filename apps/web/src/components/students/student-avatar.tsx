"use client";

import { useState } from "react";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import { useStudentPhoto } from "@/lib/students/photo";
import { cn } from "@/lib/utils";

interface StudentAvatarProps {
  name: string;
  studentId?: string;
  hasPhoto?: boolean;
  /** Supabase public/signed URL from the API (preferred). */
  photoUrl?: string | null;
  /** Local blob/data URL preview — used during form editing before save. */
  previewUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  clickable?: boolean;
  className?: string;
}

const SIZE: Record<NonNullable<StudentAvatarProps["size"]>, string> = {
  sm: "h-10 w-10 text-sm rounded-xl",
  md: "h-16 w-16 text-2xl rounded-2xl",
  lg: "h-24 w-24 text-3xl rounded-2xl",
  xl: "h-32 w-32 text-4xl rounded-3xl",
};

export function StudentAvatar({
  name,
  studentId,
  hasPhoto,
  photoUrl: apiPhotoUrl,
  previewUrl,
  size = "md",
  clickable = true,
  className,
}: StudentAvatarProps) {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const photoUrl = useStudentPhoto(
    studentId,
    hasPhoto ?? !!apiPhotoUrl,
    apiPhotoUrl,
    previewUrl,
  );
  const initial = name.trim().charAt(0).toUpperCase() || "?";
  const canPreview = Boolean(photoUrl && clickable);

  const shell = (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden bg-gradient-to-br from-blue-500 to-indigo-600 font-bold text-white shadow-sm ring-2 ring-background",
        SIZE[size],
        canPreview && "cursor-zoom-in transition hover:ring-primary/40",
        className,
      )}
    >
      {photoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={photoUrl}
          alt={name}
          className="h-full w-full object-cover"
          onError={(e) => {
            console.error(`[students] image failed to load for ${name}:`, photoUrl);
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        initial
      )}
    </span>
  );

  return (
    <>
      {canPreview ? (
        <button
          type="button"
          onClick={() => setLightboxOpen(true)}
          className="rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`View photo of ${name}`}
        >
          {shell}
        </button>
      ) : (
        shell
      )}
      {photoUrl ? (
        <ImageLightbox
          open={lightboxOpen}
          src={photoUrl}
          alt={name}
          onClose={() => setLightboxOpen(false)}
        />
      ) : null}
    </>
  );
}
