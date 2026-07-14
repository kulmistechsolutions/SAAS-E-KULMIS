import { Global, Module } from "@nestjs/common";
import { AutoStorageService } from "./auto-storage.service";
import { LocalFilesystemStorageService } from "./local-storage.service";
import { MinioStorageService, StorageService } from "./storage.service";
import { SupabaseStorageService } from "./supabase-storage.service";

/** Global object storage. Prefers Supabase Storage when configured. */
@Global()
@Module({
  providers: [
    SupabaseStorageService,
    MinioStorageService,
    LocalFilesystemStorageService,
    AutoStorageService,
    { provide: StorageService, useExisting: AutoStorageService },
  ],
  exports: [StorageService],
})
export class StorageModule {}
