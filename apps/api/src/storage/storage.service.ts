import { Injectable, NotImplementedException } from "@nestjs/common";

/**
 * Object-storage abstraction. Callers MUST namespace keys by tenant, e.g.
 * `${schoolId}/logos/logo.png`, so tenants never share paths.
 *
 * Swapping MinIO <-> S3/R2 later = swapping the implementation bound in
 * StorageModule; call sites never change.
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
}

/**
 * Placeholder implementation. Phase 1 wires the real MinIO client; until then
 * calls fail loudly rather than silently no-op.
 */
@Injectable()
export class MinioStorageService extends StorageService {
  private notReady(): never {
    throw new NotImplementedException(
      "Storage backend not configured yet (Phase 1: wire MinIO / S3).",
    );
  }

  putObject(): Promise<void> {
    return this.notReady();
  }

  getSignedUrl(): Promise<string> {
    return this.notReady();
  }

  removeObject(): Promise<void> {
    return this.notReady();
  }
}
