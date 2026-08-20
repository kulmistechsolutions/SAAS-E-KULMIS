import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
  UpdateExpenseInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "../academics/prisma-errors";

@Injectable()
export class ExpensesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Categories ──
  createCategory(schoolId: string, dto: CreateExpenseCategoryInput) {
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.expenseCategory.create({ data: { schoolId, name: dto.name } }),
      )
      .catch(onUniqueViolation("A category with this name already exists"));
  }

  /**
   * A school's expense categories, seeding its configured defaults the first
   * time it has none.
   *
   * Settings → Expenses lists "Default Categories", which until now was a
   * list nothing ever read. Seeding only on an empty set means this can
   * never overwrite or duplicate what a school has already built up — once
   * it has one category of its own, this stays out of the way.
   */
  async listCategories(schoolId: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    );
    if (existing.length > 0) return existing;

    const defaults = await this.defaultCategories(schoolId);
    if (defaults.length === 0) return existing;

    await this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.createMany({
        data: defaults.map((name) => ({ schoolId, name })),
        skipDuplicates: true,
      }),
    );
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    );
  }

  /** The category names a school listed in Settings → Expenses. */
  private async defaultCategories(schoolId: string): Promise<string[]> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { expenseSettings: true },
    });
    const s = school?.expenseSettings as
      | { defaultCategories?: unknown }
      | null;
    const raw = Array.isArray(s?.defaultCategories) ? s.defaultCategories : [];
    return [
      ...new Set(
        raw
          .filter((n): n is string => typeof n === "string")
          .map((n) => n.trim())
          .filter(Boolean),
      ),
    ];
  }

  async removeCategory(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Category not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.delete({ where: { id } }),
    );
    return { success: true };
  }

  // ── Expenses ──
  create(schoolId: string, dto: CreateExpenseInput, recordedByUserId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.create({
        data: {
          schoolId,
          categoryId: dto.categoryId ?? null,
          title: dto.title,
          amount: dto.amount,
          method: dto.method ?? null,
          note: dto.note ?? null,
          spentAt: dto.spentAt ?? new Date(),
          recordedByUserId,
        },
      }),
    );
  }

  async update(schoolId: string, id: string, dto: UpdateExpenseInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Expense not found");

    return this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.update({
        where: { id },
        data: {
          ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
          ...(dto.title !== undefined ? { title: dto.title } : {}),
          ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
          ...(dto.method !== undefined ? { method: dto.method } : {}),
          ...(dto.note !== undefined ? { note: dto.note } : {}),
          ...(dto.spentAt !== undefined ? { spentAt: dto.spentAt } : {}),
        },
      }),
    );
  }

  findAll(schoolId: string, categoryId?: string) {
    const where: Prisma.ExpenseWhereInput = {};
    if (categoryId) where.categoryId = categoryId;
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.findMany({
        where,
        include: { category: { select: { id: true, name: true } } },
        orderBy: { spentAt: "desc" },
      }),
    );
  }

  async remove(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Expense not found");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.expense.delete({ where: { id } }),
    );
    return { success: true };
  }
}
