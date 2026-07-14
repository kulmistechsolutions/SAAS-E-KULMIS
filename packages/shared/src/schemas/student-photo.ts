import { z } from "zod";

export const uploadStudentPhotoSchema = z.object({
  file: z.string().min(1, "Photo data is required"),
  mimeType: z.enum(["image/jpeg", "image/png", "image/webp"]),
});

export type UploadStudentPhotoInput = z.infer<typeof uploadStudentPhotoSchema>;
