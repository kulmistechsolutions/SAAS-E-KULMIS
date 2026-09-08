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

  /**
   * A tenant's audit entries (RLS-scoped), newest first.
   *
   * Filtered, because an audit log nobody can search is an archive rather than
   * a record: the question a school arrives with is "who changed this family's
   * fee in August", and paging fifty at a time through every login in the
   * school is not a way to answer it.
   */
  async list(
    schoolId: string,
    opts: {
      skip?: number;
      take?: number;
      module?: string;
      action?: string;
      /** Matches a username, an action, or anything in the metadata. */
      q?: string;
      from?: string;
      to?: string;
    } = {},
  ) {
    const take = Math.min(Math.max(opts.take ?? 50, 1), 200);
    const skip = Math.max(opts.skip ?? 0, 0);

    const where: Prisma.AuditLogWhereInput = {};
    if (opts.module) where.module = opts.module;
    if (opts.action) where.action = opts.action;

    const from = opts.from ? new Date(opts.from) : null;
    const to = opts.to ? new Date(opts.to) : null;
    if (from && !Number.isNaN(from.getTime())) {
      where.createdAt = { ...(where.createdAt as object), gte: from };
    }
    if (to && !Number.isNaN(to.getTime())) {
      // A date with no time means the whole of that day, which is what a
      // person picking "to: 30 September" means by it.
      const end = new Date(to);
      if (opts.to && opts.to.length <= 10) end.setUTCHours(23, 59, 59, 999);
      where.createdAt = { ...(where.createdAt as object), lte: end };
    }

    const q = opts.q?.trim();
    if (q) {
      where.OR = [
        { username: { contains: q, mode: "insensitive" } },
        { action: { contains: q, mode: "insensitive" } },
        { module: { contains: q, mode: "insensitive" } },
      ];
    }

    const [items, total] = await this.prisma.forTenant(schoolId, (tx) =>
      Promise.all([
        tx.auditLog.findMany({
          where,
          orderBy: { createdAt: "desc" },
          skip,
          take,
        }),
        tx.auditLog.count({ where }),
      ]),
    );
    return { items, total, skip, take };
  }

  /** The modules and actions this school actually has entries for. */
  async facets(schoolId: string) {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.auditLog.groupBy({
        by: ["module", "action"],
        _count: { _all: true },
      }),
    );
    const modules = new Map<string, number>();
    const actions = new Map<string, number>();
    for (const r of rows) {
      modules.set(r.module, (modules.get(r.module) ?? 0) + r._count._all);
      actions.set(r.action, (actions.get(r.action) ?? 0) + r._count._all);
    }
    const sorted = (m: Map<string, number>) =>
      [...m.entries()]
        .map(([name, count]) => ({ name, count }))
        .sort((a, b) => a.name.localeCompare(b.name));
    return { modules: sorted(modules), actions: sorted(actions) };
  }
}
