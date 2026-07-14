import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as Minio from "minio";

/**
 * Object-storage abstraction. Callers MUST namespace keys by tenant, e.g.
 * `${schoolId}/logos/logo.png`, so tenants never share paths.
 */
export abstract class StorageService {
  abstract putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType?: string,
  ): Promise<void>;

  abstract getSignedUrl(
    bucket: string,
    key: string,
    expirySeconds?: number,
  ): Promise<string>;

  abstract removeObject(bucket: string, key: string): Promise<void>;

  abstract getObject(bucket: string, key: string): Promise<Buffer>;

  abstract ensureBucket(bucket: string): Promise<void>;
}

@Injectable()
export class MinioStorageService extends StorageService implements OnModuleInit {
  private readonly logger = new Logger(MinioStorageService.name);
  private client: Minio.Client | null = null;
  private readonly bucket: string;

  isAvailable(): boolean {
    return this.client !== null;
  }

  constructor(private readonly config: ConfigService) {
    super();
    this.bucket = this.config.get<string>("MINIO_BUCKET") ?? "ekulmis";
  }

  async onModuleInit(): Promise<void> {
    const endpoint = this.config.get<string>("MINIO_ENDPOINT");
    const accessKey =
      this.config.get<string>("MINIO_ACCESS_KEY") ??
      this.config.get<string>("MINIO_ROOT_USER");
    const secretKey =
      this.config.get<string>("MINIO_SECRET_KEY") ??
      this.config.get<string>("MINIO_ROOT_PASSWORD");
    if (!endpoint || !accessKey || !secretKey) {
      this.logger.warn(
        "MinIO not configured (MINIO_ENDPOINT/ACCESS_KEY/SECRET_KEY). File uploads disabled.",
      );
      return;
    }
    const port = Number(this.config.get<string>("MINIO_PORT") ?? "9000");
    const useSSL = this.config.get<string>("MINIO_USE_SSL") === "true";
    try {
      this.client = new Minio.Client({
        endPoint: endpoint,
        port,
        useSSL,
        accessKey,
        secretKey,
      });
      await this.ensureBucket(this.bucket);
      this.logger.log(`MinIO connected — bucket "${this.bucket}"`);
    } catch (err) {
      this.client = null;
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `MinIO unreachable (${endpoint}:${port}). File uploads disabled. ${message}`,
      );
    }
  }

  private requireClient(): Minio.Client {
    if (!this.client) {
      throw new Error("MinIO storage is not configured");
    }
    return this.client;
  }

  async ensureBucket(bucket: string): Promise<void> {
    const client = this.requireClient();
    const exists = await client.bucketExists(bucket);
    if (!exists) {
      await client.makeBucket(bucket, "us-east-1");
    }
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    contentType = "application/octet-stream",
  ): Promise<void> {
    const client = this.requireClient();
    await client.putObject(bucket, key, body, body.length, {
      "Content-Type": contentType,
    });
  }

  async getSignedUrl(
    bucket: string,
    key: string,
    expirySeconds = 3600,
  ): Promise<string> {
    const client = this.requireClient();
    return client.presignedGetObject(bucket, key, expirySeconds);
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    const client = this.requireClient();
    await client.removeObject(bucket, key);
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    const client = this.requireClient();
    const stream = await client.getObject(bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return Buffer.concat(chunks);
  }
}
