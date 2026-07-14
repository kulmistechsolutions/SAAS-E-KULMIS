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

export abstract class SearchService {
  abstract search(
    schoolId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit[]>;
}
