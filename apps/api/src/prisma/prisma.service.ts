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
    super({ transactionOptions: { maxWait: 20000, timeout: 20000 } });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma connected");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /**
   * Run a callback inside a transaction with the tenant context set, so
   * Row-Level Security policies scope every query to `schoolId`.
   */
  async forTenant<T>(
    schoolId: string,
    fn: (tx: PrismaClient) => Promise<T>,
  ): Promise<T> {
    return this.$transaction(async (tx) => {
      // Drop from the privileged connection role (which bypasses RLS) to the
      // restricted `app_user` role that RLS policies actually apply to.
      await tx.$executeRawUnsafe("SET LOCAL ROLE app_user");
      // Parameterized (bound) value — safe against injection. `true` = LOCAL
      // (scoped to this transaction), so it resets when the tx ends.
      await tx.$executeRaw`SELECT set_config('app.current_tenant', ${schoolId}, true)`;
      return fn(tx as unknown as PrismaClient);
    });
  }
}
