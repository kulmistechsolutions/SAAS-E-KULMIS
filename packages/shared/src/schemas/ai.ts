import { z } from "zod";

/** Which service the key belongs to. Both speak the OpenAI chat API. */
export const AI_PROVIDERS = ["openai", "openrouter"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

/** Super-admin update of the platform AI config. */
export const updateAiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  provider: z.enum(AI_PROVIDERS).optional(),
  // Blank/omitted = keep the stored key (the UI only sends a new one to change it).
  apiKey: z.string().optional(),
  model: z.string().min(1).optional(),
});

export type UpdateAiConfigInput = z.infer<typeof updateAiConfigSchema>;
