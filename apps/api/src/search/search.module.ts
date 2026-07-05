import { Global, Module } from "@nestjs/common";
import { PostgresSearchService, SearchService } from "./search.service";

/** Global search. Bind a different impl here to switch search engines. */
@Global()
@Module({
  providers: [{ provide: SearchService, useClass: PostgresSearchService }],
  exports: [SearchService],
})
export class SearchModule {}
