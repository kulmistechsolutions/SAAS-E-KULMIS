import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import type {
  CreateBookInput,
  IssueBookInput,
  UpdateBookInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

const loanInclude = {
  book: { select: { id: true, title: true, author: true } },
  student: { select: { id: true, code: true, fullName: true } },
} satisfies Prisma.BookLoanInclude;

@Injectable()
export class LibraryService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Books ────────────────────────────────────────────────────────────────
  listBooks(schoolId: string, q?: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.book.findMany({
        where: q
          ? {
              OR: [
                { title: { contains: q, mode: "insensitive" } },
                { author: { contains: q, mode: "insensitive" } },
                { isbn: { contains: q, mode: "insensitive" } },
                { category: { contains: q, mode: "insensitive" } },
              ],
            }
          : undefined,
        orderBy: { title: "asc" },
      }),
    );
  }

  createBook(schoolId: string, dto: CreateBookInput) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.book.create({
        data: {
          schoolId,
          title: dto.title,
          author: dto.author ?? null,
          isbn: dto.isbn ?? null,
          category: dto.category ?? null,
          totalCopies: dto.totalCopies,
          availableCopies: dto.totalCopies,
        },
      }),
    );
  }

  async updateBook(schoolId: string, id: string, dto: UpdateBookInput) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const book = await tx.book.findFirst({ where: { id } });
      if (!book) throw new NotFoundException("Book not found");

      // Keep availableCopies consistent when the total changes: shift it by the
      // same delta, never below the number currently on loan.
      let availableCopies = book.availableCopies;
      if (dto.totalCopies !== undefined && dto.totalCopies !== book.totalCopies) {
        const onLoan = book.totalCopies - book.availableCopies;
        if (dto.totalCopies < onLoan) {
          throw new BadRequestException(
            `There are ${onLoan} copies on loan — total cannot be below that.`,
          );
        }
        availableCopies = dto.totalCopies - onLoan;
      }

      return tx.book.update({
        where: { id },
        data: {
          title: dto.title,
          author: dto.author,
          isbn: dto.isbn,
          category: dto.category,
          totalCopies: dto.totalCopies,
          status: dto.status,
          availableCopies,
        },
      });
    });
  }

  async removeBook(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const active = await tx.bookLoan.count({
        where: { bookId: id, status: { in: ["ISSUED", "OVERDUE"] } },
      });
      if (active > 0) {
        throw new ConflictException(
          "This book has copies on loan and cannot be deleted.",
        );
      }
      await tx.book.delete({ where: { id } });
      return { success: true };
    });
  }

  // ── Loans ────────────────────────────────────────────────────────────────
  listLoans(
    schoolId: string,
    filters: { status?: string; studentId?: string; bookId?: string } = {},
  ) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.bookLoan.findMany({
        where: {
          status: filters.status as never,
          studentId: filters.studentId,
          bookId: filters.bookId,
        },
        include: loanInclude,
        orderBy: { issuedAt: "desc" },
      }),
    );
  }

  async issueBook(schoolId: string, dto: IssueBookInput, userId?: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const [book, student] = await Promise.all([
        tx.book.findFirst({ where: { id: dto.bookId } }),
        tx.student.findFirst({
          where: { id: dto.studentId },
          select: { id: true },
        }),
      ]);
      if (!book) throw new BadRequestException("Invalid book");
      if (!student) throw new BadRequestException("Invalid student");
      if (book.status !== "ACTIVE") {
        throw new BadRequestException("This book is not active");
      }
      if (book.availableCopies < 1) {
        throw new ConflictException("No copies available to issue");
      }

      const loan = await tx.bookLoan.create({
        data: {
          schoolId,
          bookId: dto.bookId,
          studentId: dto.studentId,
          dueDate: dto.dueDate,
          status: "ISSUED",
          issuedByUserId: userId ?? null,
        },
        include: loanInclude,
      });
      await tx.book.update({
        where: { id: dto.bookId },
        data: { availableCopies: { decrement: 1 } },
      });
      return loan;
    });
  }

  async returnBook(schoolId: string, loanId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const loan = await tx.bookLoan.findFirst({ where: { id: loanId } });
      if (!loan) throw new NotFoundException("Loan not found");
      if (loan.status === "RETURNED") {
        throw new BadRequestException("This book was already returned");
      }
      const updated = await tx.bookLoan.update({
        where: { id: loanId },
        data: { status: "RETURNED", returnedAt: new Date() },
        include: loanInclude,
      });
      await tx.book.update({
        where: { id: loan.bookId },
        data: { availableCopies: { increment: 1 } },
      });
      return updated;
    });
  }

  async dashboard(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const today = new Date();
      const [titles, copies, issued, overdue] = await Promise.all([
        tx.book.count(),
        tx.book.aggregate({ _sum: { totalCopies: true } }),
        tx.bookLoan.count({ where: { status: { in: ["ISSUED", "OVERDUE"] } } }),
        tx.bookLoan.count({
          where: {
            status: { in: ["ISSUED", "OVERDUE"] },
            dueDate: { lt: today },
          },
        }),
      ]);
      return {
        totalTitles: titles,
        totalCopies: copies._sum.totalCopies ?? 0,
        issued,
        overdue,
      };
    });
  }
}
