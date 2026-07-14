import { BadRequestException } from "@nestjs/common";

export const STUDENT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const STUDENT_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type StudentPhotoMime = (typeof STUDENT_PHOTO_MIME_TYPES)[number];

export function assertStudentPhotoMime(mime: string): StudentPhotoMime {
  if (!STUDENT_PHOTO_MIME_TYPES.includes(mime as StudentPhotoMime)) {
    throw new BadRequestException(
      "Unsupported image format. Use JPEG, PNG, or WebP.",
    );
  }
  return mime as StudentPhotoMime;
}

export function photoExtension(mime: StudentPhotoMime): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "jpg";
  }
}

export function studentPhotoKey(
  schoolId: string,
  studentId: string,
  ext: string,
): string {
  return `${schoolId}/students/${studentId}/photo.${ext}`;
}

export function photoContentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
