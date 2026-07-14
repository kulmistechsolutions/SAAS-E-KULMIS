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
} from "@nestjs/common";
import {
  createBookSchema,
  issueBookSchema,
  updateBookSchema,
  UserRole,
} from "@ekulmis/shared";
import { LibraryService } from "./library.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

// Library is managed by administrators and librarians only.
@Roles(UserRole.ADMINISTRATOR, UserRole.LIBRARIAN)
@Controller("library")
export class LibraryController {
  constructor(private readonly library: LibraryService) {}

  @Get("dashboard")
  dashboard(@CurrentUser() me: AuthUser) {
    return this.library.dashboard(me.schoolId);
  }

  // ── Books ──
  @Get("books")
  listBooks(@CurrentUser() me: AuthUser, @Query("q") q?: string) {
    return this.library.listBooks(me.schoolId, q?.trim() || undefined);
  }

  @Post("books")
  createBook(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createBookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.createBook(me.schoolId, parsed.data);
  }

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

  @Delete("books/:id")
  removeBook(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.library.removeBook(me.schoolId, id);
  }

  // ── Loans ──
  @Get("loans")
  listLoans(
    @CurrentUser() me: AuthUser,
    @Query("status") status?: string,
    @Query("studentId") studentId?: string,
    @Query("bookId") bookId?: string,
  ) {
    return this.library.listLoans(me.schoolId, { status, studentId, bookId });
  }

  @Post("loans")
  issue(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = issueBookSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.library.issueBook(me.schoolId, parsed.data, me.userId);
  }

  @Post("loans/:id/return")
  return(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.library.returnBook(me.schoolId, id);
  }
}
