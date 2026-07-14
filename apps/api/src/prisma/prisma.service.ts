import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

/**
 * Prisma database client as an injectable NestJS service.
 *
 * Multi-tenancy note (Phase 0.5): tenant isolation is enforced by setting
 * `app.current_tenant` per transaction (see `forTenant`) together with
 * PostgreSQL Row-Level Security. Application code must always go through a
 * tenant-scoped client for domain tables.
 */
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    // Tolerate network latency to the (managed) database in tenant transactions.
    // The shared Supabase pooler can add several seconds of latency per query,
    // so a multi-query tenant transaction (e.g. the teacher dashboard) needs a
    // generous ceiling — otherwise it aborts mid-flight and the UI shows an
    // endless loading spinner / 500 instead of (slow) data.
    super({ transactionOptions: { maxWait: 30000, timeout: 60000 } });
  }

  async onModuleInit(): Promise<void> {
    const attempts = 5;
    let lastError: unknown;
    for (let i = 1; i <= attempts; i++) {
      try {
        await this.$connect();
        this.logger.log("Prisma connected");
        return;
      } catch (err) {
        lastError = err;
        this.logger.warn(
          `Prisma connect attempt ${i}/${attempts} failed — retrying…`,
        );
        await new Promise((r) => setTimeout(r, 1500 * i));
      }
    }
    throw lastError;
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run a callback inside a transaction with the tenant context set, so
   * Row-Level Security policies scope every query to `schoolId`.
   *
   * Optional `timeout`/`maxWait` override the default 20s — needed for
   * heavy read aggregations (e.g. admin dashboard) over a remote pooler.
   */
  async forTenant<T>(
    schoolId: string,
    fn: (tx: PrismaClient) => Promise<T>,
    opts?: { timeout?: number; maxWait?: number },
  ): Promise<T> {
    return this.$transaction(
      async (tx) => {
        // ONE round-trip that both (a) drops from the privileged connection role
        // to the restricted `app_user` role RLS applies to, and (b) sets the
        // tenant. `set_config('role', 'app_user', true)` is equivalent to
        // `SET LOCAL ROLE app_user`; combining them removes a round-trip on the
        // hot path of every tenant query. `true` = LOCAL (resets when the tx
        // ends); the schoolId is a bound parameter (injection-safe).
        await tx.$executeRaw`SELECT set_config('role', 'app_user', true), set_config('app.current_tenant', ${schoolId}, true)`;
        return fn(tx as unknown as PrismaClient);
      },
      {
        // The shared Supabase pooler can add several seconds of latency per
        // query, so even a small tenant transaction needs a generous ceiling —
        // otherwise it expires mid-flight and the UI shows a 500 / endless
        // spinner instead of (slow) data. Callers may still override per-call.
        maxWait: opts?.maxWait ?? 30_000,
        timeout: opts?.timeout ?? 60_000,
      },
    );
  }
}
