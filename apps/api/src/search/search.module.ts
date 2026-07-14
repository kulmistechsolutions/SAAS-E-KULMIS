import { Global, Module } from "@nestjs/common";
import { PostgresSearchService } from "./postgres-search.service";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Global()
@Module({
  controllers: [SearchController],
  providers: [{ provide: SearchService, useClass: PostgresSearchService }],
  exports: [SearchService],
})
export class SearchModule {}
