import { Injectable } from "@nestjs/common";

export interface SearchHit {
  id: string;
  type: string;
  label: string;
}

export interface SearchOptions {
  types?: string[];
  limit?: number;
}

/**
 * Global search abstraction. Every query is tenant-scoped by `schoolId`.
 *
 * Swapping PostgreSQL FTS <-> Meilisearch/OpenSearch later = swapping the
 * implementation bound in SearchModule; call sites never change.
 */
export abstract class SearchService {
  abstract search(
    schoolId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit[]>;
}

/**
 * Placeholder implementation. Phase 1 wires PostgreSQL full-text search across
 * the tenant's students/teachers/parents/etc. Returns nothing for now.
 */
@Injectable()
export class PostgresSearchService extends SearchService {
  async search(): Promise<SearchHit[]> {
    return [];
  }
}
