import { Global, Module } from "@nestjs/common";
import { DocumentsService } from "./documents.service";
import { ExportsController } from "./exports.controller";

@Global()
@Module({
  controllers: [ExportsController],
  providers: [DocumentsService],
  exports: [DocumentsService],
})
export class DocumentsModule {}
