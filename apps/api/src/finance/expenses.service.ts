import { Injectable, NotFoundException } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type {
  CreateExpenseCategoryInput,
  CreateExpenseInput,
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

  listCategories(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.expenseCategory.findMany({ orderBy: { name: "asc" } }),
    );
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
