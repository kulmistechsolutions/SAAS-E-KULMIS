import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import type { Response } from "express";
import {
  createBookSchema,
  createLibraryDocumentSchema,
  issueBookSchema,
  updateBookSchema,
  updateLibraryDocumentSchema,
  UserRole,
} from "@ekulmis/shared";
import { LibraryService } from "./library.service";
import { LIBRARY_PDF_MAX_BYTES } from "./library-file.util";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { contentDispositionHeader } from "../common/content-disposition.util";
import { RequirePermission } from "../auth/require-permission.decorator";

/**
 * Minimal shape of a multer upload — @types/multer isn't installed and the
 * only fields we need are these three.
 */
interface UploadedPdf {
  buffer: Buffer;
  mimetype: string;
  size: number;
}

// Library is managed by administrators and librarians only.
@Roles(UserRole.ADMINISTRATOR, UserRole.LIBRARIAN)
@Controller("library")
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @RequirePermission("library.view")
  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.library.dashboard(me.schoolId);
  }

  // ── Books ──
  @RequirePermission("library.view")
  @Get("books")
  listBooks(@CurrentUser() me: AuthUser, @Query("q") q?: string) {
    return this.library.listBooks(me.schoolId, q?.trim() || undefined);
  }

  @RequirePermission("library.create")
  @Post("books")
  createBook(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createBookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.createBook(me.schoolId, parsed.data);
  }

  @RequirePermission("library.update")
  @Patch("books/:id")
  updateBook(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateBookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.updateBook(me.schoolId, id, parsed.data);
  }

  @RequirePermission("library.delete")
  @Delete("books/:id")
  removeBook(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.library.removeBook(me.schoolId, id);
  }

  // ── Loans ──
  @RequirePermission("library.view")
  @Get("loans")
  listLoans(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
    @Query("studentId") studentId?: string,
    @Query("bookId") bookId?: string,
  ) {
    return this.library.listLoans(me.schoolId, { status, studentId, bookId });
  }

  @RequirePermission("library.create")
  @Post("loans")
  issue(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = issueBookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.issueBook(me.schoolId, parsed.data, me.userId);
  }

  @RequirePermission("library.update")
  @Post("loans/:id/return")
  return(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.library.returnBook(me.schoolId, id);
  }

  // ── PDF documents ──
  @RequirePermission("library.view")
  @Get("documents")
  listDocuments(
    @CurrentUser() me: AuthUser,
    @Query("q") q?: string,
    @Query("classId") classId?: string,
  ) {
    return this.library.listDocuments(me.schoolId, {
      q: q?.trim() || undefined,
      classId: classId?.trim() || undefined,
    });
  }

  @RequirePermission("library.view")
  @Get("documents/usage")
  storageUsage(@CurrentUser() me: AuthUser) {
    return this.library.storageUsage(me.schoolId);
  }

  /**
   * Multipart rather than base64 JSON: a 50 MB PDF would be ~68 MB of base64
   * and blow past API_JSON_BODY_LIMIT. Multer buffers it in memory and the
   * limit below rejects oversized uploads before they reach the handler.
   */
  @RequirePermission("library.create")
  @Post("documents")
  @UseInterceptors(
    FileInterceptor("file", { limits: { fileSize: LIBRARY_PDF_MAX_BYTES } }),
  )
  uploadDocument(
    @CurrentUser() me: AuthUser,
    @UploadedFile() file: UploadedPdf | undefined,
    @Body() body: unknown,
  ) {
    if (!file) throw new BadRequestException("A PDF file is required.");
    const parsed = createLibraryDocumentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.uploadDocument(me.schoolId, me.userId, parsed.data, file);
  }

  @RequirePermission("library.update")
  @Patch("documents/:id")
  updateDocument(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateLibraryDocumentSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.updateDocument(me.schoolId, id, parsed.data);
  }

  @RequirePermission("library.delete")
  @Delete("documents/:id")
  removeDocument(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.library.deleteDocument(me.schoolId, id);
  }

  /** Stream the PDF for staff preview. Inline so it opens in the viewer. */
  @RequirePermission("library.view")
  @Get("documents/:id/file")
  async documentFile(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { buffer, doc } = await this.library.getDocumentFile(me.schoolId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, max-age=300");
    res.setHeader(
      "Content-Disposition",
      contentDispositionHeader(`${doc.title}.pdf`, "inline"),
    );
    res.send(buffer);
  }
}
