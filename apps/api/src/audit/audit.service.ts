import { Injectable, Logger } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { UserRole } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

export interface AuditEntry {
  schoolId: string;
  userId?: string | null;
  username?: string | null;
  role?: UserRole | null;
  module: string;
  action: string;
  ip?: string | null;
  metadata?: Record<string, unknown>;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Write an audit entry. Runs on the privileged connection (bypasses RLS) with
   * an explicit schoolId. Never throws — auditing must not break the request.
   */
  async record(entry: AuditEntry): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          schoolId: entry.schoolId,
          userId: entry.userId ?? null,
          username: entry.username ?? null,
          role: entry.role ?? null,
          module: entry.module,
          action: entry.action,
          ip: entry.ip ?? null,
          ...(entry.metadata
            ? { metadata: entry.metadata as Prisma.InputJsonValue }
            : {}),
        },
      });
    } catch (e) {
      this.logger.warn(`Failed to write audit log: ${String(e)}`);
    }
  }

  /** List a tenant's audit entries (RLS-scoped), newest first. */
  async list(schoolId: string, opts: { skip?: number; take?: number } = {}) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);
    const [items, total] = await this.prisma.forTenant(schoolId, (tx) =>
      Promise.all([
        tx.auditLog.findMany({
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        tx.auditLog.count(),
      ]),
    );
    return { items, total, skip, take };
  }
}
