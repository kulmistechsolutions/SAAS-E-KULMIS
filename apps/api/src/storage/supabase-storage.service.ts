import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { StorageService } from "./storage.service";

/**
 * Supabase Storage backend. Uses the service-role key so the API can upload
 * and read objects regardless of Storage RLS (tenant isolation is enforced
 * in Nest via schoolId-prefixed keys).
 */
@Injectable()
export class SupabaseStorageService
  extends StorageService
  implements OnModuleInit
{
  private readonly logger = new Logger(SupabaseStorageService.name);
  private client: SupabaseClient | null = null;
  private publicBuckets = new Set<string>();
  private ready = false;

  constructor(private readonly config: ConfigService) {
    super();
  }

  isAvailable(): boolean {
    return this.ready && this.client !== null;
  }

  async onModuleInit(): Promise<void> {
    const url = this.config.get<string>("SUPABASE_URL")?.trim();
    const serviceKey = this.config.get<string>("SUPABASE_SERVICE_ROLE_KEY")?.trim();
    if (!url || !serviceKey) {
      this.logger.warn(
        "Supabase Storage not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY).",
      );
      return;
    }

    try {
      this.client = createClient(url, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      this.ready = true;

      const publicList = (
        this.config.get<string>("SUPABASE_STORAGE_PUBLIC_BUCKETS") ?? "ekulmis"
      )
        .split(",")
        .map((b) => b.trim())
        .filter(Boolean);
      this.publicBuckets = new Set(publicList);

      const defaultBucket =
        this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
        this.config.get<string>("MINIO_BUCKET") ??
        "ekulmis";
      await this.ensureBucket(defaultBucket);
      this.logger.log(
        `Supabase Storage connected — bucket "${defaultBucket}" (public=${this.publicBuckets.has(defaultBucket)})`,
      );
    } catch (err) {
      this.client = null;
      this.ready = false;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Supabase Storage init failed: ${message}`);
    }
  }

  private requireClient(): SupabaseClient {
    if (!this.client || !this.ready) {
      throw new Error("Supabase Storage is not configured");
    }
    return this.client;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const client = this.requireClient();
    const wantPublic = this.publicBuckets.has(bucket);
    const { data: existing, error: getErr } = await client.storage.getBucket(bucket);

    if (existing && !getErr) {
      if (existing.public) this.publicBuckets.add(bucket);
      if (wantPublic && !existing.public) {
        this.logger.log(`Updating Supabase bucket "${bucket}" to public`);
        const { error: updErr } = await client.storage.updateBucket(bucket, {
          public: true,
        });
        if (updErr) {
          this.logger.warn(
            `Could not make bucket "${bucket}" public: ${updErr.message}. ` +
              "Set the bucket to Public in Supabase Dashboard → Storage.",
          );
        } else {
          this.publicBuckets.add(bucket);
        }
      }
      return;
    }

    this.logger.log(`Creating Supabase Storage bucket "${bucket}" (public=${wantPublic})`);
    const { error } = await client.storage.createBucket(bucket, {
      public: wantPublic,
      fileSizeLimit: 5 * 1024 * 1024,
      allowedMimeTypes: [
        "image/jpeg",
        "image/png",
        "image/webp",
        "application/octet-stream",
        "application/json",
      ],
    });
    if (error && !/already exists/i.test(error.message)) {
      throw new Error(`Failed to create bucket "${bucket}": ${error.message}`);
    }
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType = "application/octet-stream",
  ): Promise<void> {
    const client = this.requireClient();
    await this.ensureBucket(bucket);
    this.logger.log(
      `Supabase upload start bucket=${bucket} key=${key} bytes=${body.length} type=${contentType}`,
    );
    const { data, error } = await client.storage.from(bucket).upload(key, body, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });
    if (error) {
      this.logger.error(
        `Supabase upload failed bucket=${bucket} key=${key}: ${error.message}`,
      );
      throw new Error(error.message);
    }
    this.logger.log(
      `Supabase upload ok bucket=${bucket} path=${data?.path ?? key}`,
    );
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const client = this.requireClient();
    if (this.publicBuckets.has(bucket)) {
      const { data } = client.storage.from(bucket).getPublicUrl(key);
      this.logger.debug(`Supabase public URL bucket=${bucket} key=${key}`);
      return data.publicUrl;
    }
    const { data, error } = await client.storage
      .from(bucket)
      .createSignedUrl(key, expirySeconds);
    if (error || !data?.signedUrl) {
      throw new Error(error?.message ?? "Failed to create signed URL");
    }
    this.logger.debug(`Supabase signed URL bucket=${bucket} key=${key}`);
    return data.signedUrl;
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    const client = this.requireClient();
    const { error } = await client.storage.from(bucket).remove([key]);
    if (error) {
      this.logger.warn(
        `Supabase remove failed bucket=${bucket} key=${key}: ${error.message}`,
      );
    } else {
      this.logger.log(`Supabase removed bucket=${bucket} key=${key}`);
    }
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const client = this.requireClient();
    const { data, error } = await client.storage.from(bucket).download(key);
    if (error || !data) {
      throw new Error(error?.message ?? `Object not found: ${bucket}/${key}`);
    }
    const ab = await data.arrayBuffer();
    return Buffer.from(ab);
  }
}
