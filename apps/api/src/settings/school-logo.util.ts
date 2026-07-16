import { BadRequestException } from "@nestjs/common";

export const SCHOOL_LOGO_MAX_BYTES = 2 * 1024 * 1024;

export const SCHOOL_LOGO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/svg+xml",
] as const;

export type SchoolLogoMime = (typeof SCHOOL_LOGO_MIME_TYPES)[number];

export function assertSchoolLogoMime(mime: string): SchoolLogoMime {
  if (!SCHOOL_LOGO_MIME_TYPES.includes(mime as SchoolLogoMime)) {
    throw new BadRequestException(
      "Unsupported image format. Use JPEG, PNG, WebP, or SVG.",
    );
  }
  return mime as SchoolLogoMime;
}

export function logoExtension(mime: SchoolLogoMime): string {
  switch (mime) {
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    case "image/svg+xml":
      return "svg";
    default:
      return "png";
  }
}

export function schoolLogoKey(schoolId: string, ext: string): string {
  return `${schoolId}/school/logo.${ext}`;
}

export function logoContentTypeFromKey(key: string): string {
  const ext = key.split(".").pop()?.toLowerCase();
  switch (ext) {
    case "png":
      return "image/png";
    case "webp":
      return "image/webp";
    case "svg":
      return "image/svg+xml";
    case "jpg":
    case "jpeg":
      return "image/jpeg";
    default:
      return "application/octet-stream";
  }
}
