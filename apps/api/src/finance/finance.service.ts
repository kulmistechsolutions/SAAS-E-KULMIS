import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

/** Finance Dashboard (Module 10): Net Income = Income − Expenses − Salaries. */
@Injectable()
export class FinanceService {
  constructor(private readonly prisma: PrismaService) {}

  dashboard(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [payAgg, expAgg, salAgg, outstandingCharges] = await Promise.all([
        tx.payment.aggregate({ _sum: { amount: true } }),
        tx.expense.aggregate({ _sum: { amount: true } }),
        tx.salary.aggregate({
          _sum: { amount: true },
          where: { status: "PAID" },
        }),
        tx.feeCharge.findMany({
          where: { status: { not: "PAID" } },
          select: { amount: true, paidAmount: true },
        }),
      ]);

      const totalIncome = payAgg._sum.amount ?? 0;
      const totalExpenses = expAgg._sum.amount ?? 0;
      const totalSalaries = salAgg._sum.amount ?? 0;
      const totalOutstanding = outstandingCharges.reduce(
        (sum, c) => sum + (c.amount - c.paidAmount),
        0,
      );

      return {
        totalIncome,
        totalExpenses,
        totalSalaries,
        netIncome: totalIncome - totalExpenses - totalSalaries,
        totalOutstanding,
      };
    });
  }
}
