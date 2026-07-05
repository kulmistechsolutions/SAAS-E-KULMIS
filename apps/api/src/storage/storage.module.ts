import { Global, Module } from "@nestjs/common";
import { MinioStorageService, StorageService } from "./storage.service";

/** Global object storage. Bind a different impl here to switch backends. */
@Global()
@Module({
  providers: [{ provide: StorageService, useClass: MinioStorageService }],
  exports: [StorageService],
})
export class StorageModule {}
