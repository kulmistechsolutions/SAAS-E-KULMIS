import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type {
  CreateBookInput,
  CreateLibraryDocumentInput,
  IssueBookInput,
  UpdateBookInput,
  UpdateLibraryDocumentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import {
  LIBRARY_PDF_MAX_BYTES,
  assertLibraryPdfMime,
  formatMb,
  libraryDocumentKey,
} from "./library-file.util";

const loanInclude = {
  book: { select: { id: true, title: true, author: true } },
  student: { select: { id: true, code: true, fullName: true } },
} satisfies Prisma.BookLoanInclude;

@Injectable()
export class LibraryService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly subscriptions: SubscriptionsService,
  ) {
    this.bucket =
      this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
      this.config.get<string>("MINIO_BUCKET") ??
      "ekulmis";
  }

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

  // ── PDF documents ────────────────────────────────────────────────────────

  /** Admin/librarian view: every document, newest first. */
  listDocuments(schoolId: string, opts: { q?: string; classId?: string } = {}) {
    const q = opts.q?.trim();
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findMany({
        where: {
          ...(opts.classId ? { classId: opts.classId } : {}),
          ...(q
            ? {
                OR: [
                  { title: { contains: q, mode: "insensitive" as const } },
                  { author: { contains: q, mode: "insensitive" as const } },
                  { description: { contains: q, mode: "insensitive" as const } },
                ],
              }
            : {}),
        },
        include: { class: { select: { id: true, name: true } } },
        orderBy: { createdAt: "desc" },
      }),
    );
  }

  async uploadDocument(
    schoolId: string,
    userId: string | undefined,
    dto: CreateLibraryDocumentInput,
    file: { buffer: Buffer; mimetype: string; size: number },
  ) {
    assertLibraryPdfMime(file.mimetype);
    if (!file.buffer?.length) {
      throw new BadRequestException("The uploaded file is empty.");
    }
    if (file.buffer.length > LIBRARY_PDF_MAX_BYTES) {
      throw new BadRequestException(
        `The PDF is ${formatMb(file.buffer.length)}. Maximum is ${formatMb(LIBRARY_PDF_MAX_BYTES)}.`,
      );
    }
    // A PDF always starts with "%PDF-"; a renamed .exe/.zip would not.
    if (file.buffer.subarray(0, 5).toString("ascii") !== "%PDF-") {
      throw new BadRequestException("That file is not a valid PDF.");
    }
    await this.subscriptions.assertLibraryStorage(schoolId, file.buffer.length);

    if (dto.classId) {
      const cls = await this.prisma.forTenant(schoolId, (tx) =>
        tx.class.findFirst({ where: { id: dto.classId! }, select: { id: true } }),
      );
      if (!cls) throw new NotFoundException("Class not found");
    }

    // Create the row first so the storage key can use its id, then upload. If
    // the upload fails the row is removed, so a document never points at a
    // file that isn't there.
    const created = await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.create({
        data: {
          schoolId,
          title: dto.title,
          description: dto.description ?? null,
          author: dto.author ?? null,
          classId: dto.classId ?? null,
          fileKey: "",
          fileSizeBytes: file.buffer.length,
          allowDownload: dto.allowDownload,
          uploadedByUserId: userId ?? null,
        },
      }),
    );

    const key = libraryDocumentKey(schoolId, created.id);
    try {
      await this.storage.putObject(this.bucket, key, file.buffer, "application/pdf");
    } catch {
      await this.prisma
        .forTenant(schoolId, (tx) =>
          tx.libraryDocument.delete({ where: { id: created.id } }),
        )
        .catch(() => undefined);
      throw new ServiceUnavailableException(
        "Could not store the PDF. Please try again.",
      );
    }

    return this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.update({
        where: { id: created.id },
        data: { fileKey: key },
        include: { class: { select: { id: true, name: true } } },
      }),
    );
  }

  async updateDocument(
    schoolId: string,
    id: string,
    dto: UpdateLibraryDocumentInput,
  ) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Document not found");
    if (dto.classId) {
      const cls = await this.prisma.forTenant(schoolId, (tx) =>
        tx.class.findFirst({ where: { id: dto.classId! }, select: { id: true } }),
      );
      if (!cls) throw new NotFoundException("Class not found");
    }
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.update({
        where: { id },
        data: {
          title: dto.title,
          description: dto.description,
          author: dto.author,
          classId: dto.classId,
          allowDownload: dto.allowDownload,
          status: dto.status,
        },
        include: { class: { select: { id: true, name: true } } },
      }),
    );
  }

  async deleteDocument(schoolId: string, id: string) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findFirst({
        where: { id },
        select: { id: true, fileKey: true },
      }),
    );
    if (!existing) throw new NotFoundException("Document not found");
    if (existing.fileKey) {
      await this.storage
        .removeObject(this.bucket, existing.fileKey)
        .catch(() => undefined);
    }
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.delete({ where: { id } }),
    );
    return { ok: true };
  }

  /** Storage used vs the plan allowance, for the admin page header. */
  storageUsage(schoolId: string) {
    return this.subscriptions.libraryStorageUsage(schoolId);
  }

  /**
   * Metadata only (no bytes) — same visibility rule as getDocumentFile, so a
   * document locked to another class 404s here too, not just on the file.
   */
  async getVisibleDocument(
    schoolId: string,
    id: string,
    opts: { studentClassId?: string } = {},
  ) {
    const doc = await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findFirst({
        where: {
          id,
          status: "ACTIVE",
          ...(opts.studentClassId
            ? { OR: [{ classId: null }, { classId: opts.studentClassId }] }
            : {}),
        },
        select: {
          id: true,
          title: true,
          description: true,
          author: true,
          fileSizeBytes: true,
          allowDownload: true,
        },
      }),
    );
    if (!doc) throw new NotFoundException("Document not found");
    return doc;
  }

  /**
   * Fetch the PDF bytes. `classId` scopes the read to what a student is
   * allowed to see: a document locked to another class is treated as missing.
   */
  async getDocumentFile(
    schoolId: string,
    id: string,
    opts: { studentClassId?: string } = {},
  ): Promise<{ buffer: Buffer; doc: { title: string; allowDownload: boolean } }> {
    const doc = await this.prisma.forTenant(schoolId, (tx) =>
      tx.libraryDocument.findFirst({
        where: {
          id,
          status: "ACTIVE",
          ...(opts.studentClassId
            ? { OR: [{ classId: null }, { classId: opts.studentClassId }] }
            : {}),
        },
        select: { fileKey: true, title: true, allowDownload: true },
      }),
    );
    if (!doc?.fileKey) throw new NotFoundException("Document not found");
    const buffer = await this.storage.getObject(this.bucket, doc.fileKey);
    return {
      buffer,
      doc: { title: doc.title, allowDownload: doc.allowDownload },
    };
  }
}
