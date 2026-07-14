import { z } from "zod";

/** Super-admin update of the platform OpenAI config. */
export const updateAiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  // Blank/omitted = keep the stored key (the UI only sends a new one to change it).
  apiKey: z.string().optional(),
  model: z.string().min(1).optional(),
});

export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;
