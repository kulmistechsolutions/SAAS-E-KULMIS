export const STUDENT_PHOTO_MAX_BYTES = 2 * 1024 * 1024;

export const STUDENT_PHOTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;

export type StudentPhotoMime = (typeof STUDENT_PHOTO_MIME_TYPES)[number];

export function validateStudentPhotoFile(file: File): string | null {
  if (!STUDENT_PHOTO_MIME_TYPES.includes(file.type as StudentPhotoMime)) {
    return "Use a JPEG, PNG, or WebP image.";
  }
  if (file.size > STUDENT_PHOTO_MAX_BYTES) {
    return "Photo must be under 2 MB.";
  }
  return null;
}

export function readStudentPhotoFile(
  file: File,
): Promise<{ previewUrl: string; base64: string; mimeType: StudentPhotoMime }> {
  const err = validateStudentPhotoFile(file);
  if (err) return Promise.reject(new Error(err));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result);
      const comma = dataUrl.indexOf(",");
      const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
      resolve({
        previewUrl: dataUrl,
        base64,
        mimeType: file.type as StudentPhotoMime,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read the image file."));
    reader.readAsDataURL(file);
  });
}
