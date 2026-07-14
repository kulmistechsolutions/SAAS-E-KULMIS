import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { StorageService } from "./storage.service";

/**
 * Dev-friendly object storage on the local filesystem.
 * Files live under LOCAL_STORAGE_PATH (default: repo .uploads/).
 */
@Injectable()
export class LocalFilesystemStorageService
  extends StorageService
  implements OnModuleInit
{
  private readonly logger = new Logger(LocalFilesystemStorageService.name);
  private baseDir = "";

  constructor(private readonly config: ConfigService) {
    super();
  }

  async onModuleInit(): Promise<void> {
    const configured = this.config.get<string>("LOCAL_STORAGE_PATH");
    this.baseDir = path.resolve(configured ?? path.join(process.cwd(), ".uploads"));
    await mkdir(this.baseDir, { recursive: true });
    this.logger.log(`Local filesystem storage active at ${this.baseDir}`);
  }

  private filePath(bucket: string, key: string): string {
    const safeKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
    return path.join(this.baseDir, bucket, ...safeKey.split("/"));
  }

  async ensureBucket(bucket: string): Promise<void> {
    await mkdir(path.join(this.baseDir, bucket), { recursive: true });
  }

  async putObject(
    bucket: string,
    key: string,
    body: Buffer,
    _contentType?: string,
  ): Promise<void> {
    const target = this.filePath(bucket, key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async getSignedUrl(_bucket: string, _key: string): Promise<string> {
    // Local files are served via the authenticated API photo proxy, not direct URLs.
    throw new Error("Local storage does not expose direct URLs");
  }

  async removeObject(bucket: string, key: string): Promise<void> {
    const target = this.filePath(bucket, key);
    await rm(target, { force: true });
  }

  async getObject(bucket: string, key: string): Promise<Buffer> {
    return readFile(this.filePath(bucket, key));
  }
}
