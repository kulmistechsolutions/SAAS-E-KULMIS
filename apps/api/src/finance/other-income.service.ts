import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateIncomeCategoryInput,
  CreateOtherIncomeInput,
  UpdateOtherIncomeInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "../academics/prisma-errors";

/**
 * Additional income (Module 9b) — money a school takes in that is not a
 * student fee: donations, hall or shop rent, canteen, transport, grants.
 *
 * Deliberately a separate table from Payment rather than a fee with no
 * student: fee collection is per-student and drives balances and receipts,
 * while this is school-level and drives nothing but the finance summary.
 * Mixing them would put phantom students in every fee report.
 */
@Injectable()
export class OtherIncomeService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ──
  createCategory(schoolId: string, dto: CreateIncomeCategoryInput) {
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.incomeCategory.create({ data: { schoolId, name: dto.name } }),
      )
      .catch(onUniqueViolation("A category with this name already exists"));
  }

  /** A school's income categories, seeded once with sensible defaults so the
   *  first entry does not have to start from an empty dropdown. */
  async listCategories(schoolId: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.incomeCategory.findMany({ orderBy: { name: "asc" } }),
    );
    if (existing.length > 0) return existing;

    await this.prisma.forTenant(schoolId, (tx) =>
      tx.incomeCategory.createMany({
        data: DEFAULT_CATEGORIES.map((name) => ({ schoolId, name })),
        skipDuplicates: true,
      }),
    );
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.incomeCategory.findMany({ orderBy: { name: "asc" } }),
    );
  }

  async removeCategory(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.incomeCategory.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Category not found");
    // Entries keep their history; the FK nulls the link rather than cascading.
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.incomeCategory.delete({ where: { id } }),
    );
    return { success: true };
  }

  // ── Entries ──
  create(
    schoolId: string,
    dto: CreateOtherIncomeInput,
    recordedByUserId: string,
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.create({
        data: {
          schoolId,
          categoryId: dto.categoryId ?? null,
          title: dto.title,
          source: dto.source ?? null,
          amount: dto.amount,
          method: dto.method ?? null,
          note: dto.note ?? null,
          receivedAt: dto.receivedAt ?? new Date(),
          recordedByUserId,
        },
      }),
    );
  }

  async update(schoolId: string, id: string, dto: UpdateOtherIncomeInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Income entry not found");

    return this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.source !== undefined ? { source: dto.source } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.method !== undefined ? { method: dto.method } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(dto.receivedAt !== undefined ? { receivedAt: dto.receivedAt } : {}),
        },
      }),
    );
  }

  findAll(schoolId: string, categoryId?: string) {
    const where: Prisma.OtherIncomeWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { receivedAt: "desc" },
      }),
    );
  }

  async remove(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Income entry not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.otherIncome.delete({ where: { id } }),
    );
    return { success: true };
  }

  /** Totals for one month, and where the money came from — the breakdown the
   *  Additional Income page and the finance summary both read. */
  async summary(schoolId: string, month?: string) {
    const range = monthRange(month);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const rows = await tx.otherIncome.findMany({
        where: range ? { receivedAt: range } : {},
        include: { category: { select: { id: true, name: true } } },
        orderBy: { receivedAt: "desc" },
      });

      const bySource = new Map<string, number>();
      for (const r of rows) {
        const key = r.category?.name ?? "Uncategorised";
        bySource.set(key, (bySource.get(key) ?? 0) + r.amount);
      }

      return {
        total: rows.reduce((sum, r) => sum + r.amount, 0),
        count: rows.length,
        bySource: [...bySource.entries()].map(([name, amount]) => ({
          name,
          amount,
        })),
        recent: rows.slice(0, 10),
      };
    });
  }
}

const DEFAULT_CATEGORIES = [
  "Donation",
  "Rent",
  "Canteen",
  "Transport",
  "Grant",
  "Other",
];

/** `YYYY-MM` → the half-open range covering that month, or null for all time. */
function monthRange(month?: string): { gte: Date; lt: Date } | null {
  if (!month || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [y, m] = month.split("-").map(Number) as [number, number];
  return {
    gte: new Date(Date.UTC(y, m - 1, 1)),
    lt: new Date(Date.UTC(y, m, 1)),
  };
}
