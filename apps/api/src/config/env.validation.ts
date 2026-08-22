import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  API_PORT: z.coerce.number().default(4000),
  APP_ROOT_DOMAIN: z.string().default("ekulmis.local"),
  DATABASE_URL: z.string().optional(),
  DIRECT_URL: z.string().optional(),
  REDIS_ENABLED: z.enum(["true", "false"]).default("false"),
  REDIS_URL: z.string().default("redis://localhost:6379"),
  JWT_ACCESS_SECRET: z.string().default("dev_access_secret_change_me"),
  JWT_REFRESH_SECRET: z.string().default("dev_refresh_secret_change_me"),
  JWT_ACCESS_TTL: z.string().default("15m"),
  JWT_REFRESH_TTL: z.string().default("7d"),
  /** Supabase Storage (preferred for student photos when DATABASE is on Supabase) */
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_STORAGE_BUCKET: z.string().optional(),
  /** Comma-separated bucket names that use public URLs */
  SUPABASE_STORAGE_PUBLIC_BUCKETS: z.string().optional(),
  MINIO_ENDPOINT: z.string().optional(),
  MINIO_PORT: z.string().optional(),
  MINIO_ACCESS_KEY: z.string().optional(),
  MINIO_SECRET_KEY: z.string().optional(),
  MINIO_BUCKET: z.string().default("ekulmis"),
  MINIO_USE_SSL: z.string().optional(),
  /** supabase | minio | local | auto (default: auto — Supabase → MinIO → local) */
  STORAGE_BACKEND: z
    .enum(["supabase", "minio", "local", "auto"])
    .default("auto"),
  LOCAL_STORAGE_PATH: z.string().optional(),
});

export type Env = z.infer<typeof envSchema>;

/** The built-in JWT secrets are public knowledge (they live in this repo), so
 *  booting production with them would let anyone forge a token for any school. */
const DEV_JWT_SECRETS = new Set([
  "dev_access_secret_change_me",
  "dev_refresh_secret_change_me",
  "change_me_access_secret",
  "change_me_refresh_secret",
]);

export function validateEnv(config: Record<string, unknown>): Env {
  const parsed = envSchema.safeParse(config);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment variables:\n${parsed.error.toString()}`,
    );
  }

  // Refuse to start rather than run a real deployment on a guessable secret.
  if (parsed.data.NODE_ENV === "production") {
    const weak = (["JWT_ACCESS_SECRET", "JWT_REFRESH_SECRET"] as const).filter(
      (k) => DEV_JWT_SECRETS.has(parsed.data[k]) || parsed.data[k].length < 32,
    );
    if (weak.length > 0) {
      throw new Error(
        `Refusing to start in production: ${weak.join(", ")} ${
          weak.length === 1 ? "is" : "are"
        } unset, a built-in development default, or shorter than 32 characters. ` +
          "Set a long random value (e.g. `openssl rand -hex 32`) for each.",
      );
    }
    if (parsed.data.JWT_ACCESS_SECRET === parsed.data.JWT_REFRESH_SECRET) {
      throw new Error(
        "Refusing to start in production: JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must differ, " +
          "so a stolen access token can never be replayed as a refresh token.",
      );
    }
  }

  return parsed.data;
}
