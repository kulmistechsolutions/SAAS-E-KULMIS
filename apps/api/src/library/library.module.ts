import { Module } from "@nestjs/common";
import { LibraryController } from "./library.controller";
import { LibraryService } from "./library.service";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";

// StorageModule is @Global, so StorageService is injectable without importing it.
@Module({
  imports: [SubscriptionsModule],
  controllers: [LibraryController],
  providers: [LibraryService],
  exports: [LibraryService],
})
export class LibraryModule {}
