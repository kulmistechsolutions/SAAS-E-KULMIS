import { BadRequestException } from "@nestjs/common";

/**
 * Parse a `YYYY-MM-DD` report/query filter into a `Date`, rejecting anything
 * else with a 400 instead of letting it reach the database. A mistyped date
 * like "20026-08-03" (one stray digit) is not a parse failure to plain
 * `new Date(...)` — JS happily treats the 5-digit year as a valid extended
 * ISO year, and Prisma's query engine then 500s trying to serialize it. Strict
 * validation up front turns that class of typo into an ordinary 400.
 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

export function parseDateFrom(
  value: string | undefined,
  field = "dateFrom",
): Date | undefined {
  if (!value) return undefined;
  if (!DATE_ONLY.test(value)) {
    throw new BadRequestException(`${field} must be in YYYY-MM-DD format`);
  }
  return new Date(`${value}T00:00:00.000Z`);
}

export function parseDateTo(
  value: string | undefined,
  field = "dateTo",
): Date | undefined {
  if (!value) return undefined;
  if (!DATE_ONLY.test(value)) {
    throw new BadRequestException(`${field} must be in YYYY-MM-DD format`);
  }
  return new Date(`${value}T23:59:59.999Z`);
}
