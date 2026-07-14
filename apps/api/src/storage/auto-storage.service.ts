import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { LocalFilesystemStorageService } from "./local-storage.service";
import { MinioStorageService, StorageService } from "./storage.service";
import { SupabaseStorageService } from "./supabase-storage.service";

type StorageBackend = "supabase" | "minio" | "local" | "auto";

/**
 * Selects storage backend after Nest has initialized each provider:
 * - supabase: Supabase Storage (preferred when configured)
 * - minio: MinIO / S3
 * - local: filesystem under apps/api/.uploads
 * - auto: Supabase → MinIO → local (dev only)
 */
@Injectable()
export class AutoStorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(AutoStorageService.name);
  private delegate: StorageService | null = null;

  constructor(
    private readonly config: ConfigService,
    private readonly supabase: SupabaseStorageService,
    private readonly minio: MinioStorageService,
    private readonly local: LocalFilesystemStorageService,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const mode = (this.config.get<string>("STORAGE_BACKEND") ??
      "auto") as StorageBackend;
    const isDev = this.config.get<string>("NODE_ENV") !== "production";

    if (mode === "local") {
      this.delegate = this.local;
      this.logger.log("Using local filesystem storage");
      return;
    }

    if (mode === "supabase") {
      this.delegate = this.supabase;
      if (!this.supabase.isAvailable()) {
        this.logger.error(
          "STORAGE_BACKEND=supabase but Supabase Storage is not available. " +
            "Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.",
        );
      } else {
        this.logger.log("Using Supabase Storage");
      }
      return;
    }

    if (mode === "minio") {
      this.delegate = this.minio;
      if (!this.minio.isAvailable()) {
        this.logger.error(
          "STORAGE_BACKEND=minio but MinIO is not available.",
        );
      } else {
        this.logger.log("Using MinIO object storage");
      }
      return;
    }

    // auto
    if (this.supabase.isAvailable()) {
      this.delegate = this.supabase;
      this.logger.log("Using Supabase Storage");
      return;
    }

    if (this.minio.isAvailable()) {
      this.delegate = this.minio;
      this.logger.log("Using MinIO object storage");
      return;
    }

    if (isDev) {
      this.delegate = this.local;
      this.logger.warn(
        "Neither Supabase nor MinIO is available — using local filesystem (apps/api/.uploads/). " +
          "Set SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY for Supabase Storage.",
      );
      return;
    }

    this.delegate = this.supabase;
    this.logger.error(
      "No object storage backend available. Configure Supabase Storage.",
    );
  }

  private impl(): StorageService {
    if (!this.delegate) {
      throw new Error("Storage service is not initialized");
    }
    return this.delegate;
  }

  putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void> {
    return this.impl().putObject(bucket, key, body, contentType);
  }

  getSignedUrl(
    bucket: string,
    key: string,
    expirySeconds?: number,
  ): Promise<string> {
    return this.impl().getSignedUrl(bucket, key, expirySeconds);
  }

  removeObject(bucket: string, key: string): Promise<void> {
    return this.impl().removeObject(bucket, key);
  }

  getObject(bucket: string, key: string): Promise<Buffer> {
    return this.impl().getObject(bucket, key);
  }

  ensureBucket(bucket: string): Promise<void> {
    return this.impl().ensureBucket(bucket);
  }
}
