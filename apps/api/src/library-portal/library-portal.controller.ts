import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Res,
  Body,
} from "@nestjs/common";
import type { Response } from "express";
import { libraryPortalLoginSchema, UserRole } from "@ekulmis/shared";
import { LibraryPortalService } from "./library-portal.service";
import { Public } from "../auth/public.decorator";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import { CurrentTenant } from "../tenant/current-tenant.decorator";
import type { AuthUser } from "../auth/auth.types";
import type { TenantContext } from "@ekulmis/shared";

/**
 * Student-facing library portal. Separate from the staff `/library`
 * controller (ADMINISTRATOR/LIBRARIAN) — this is the read-only side students
 * reach with just their Student ID, no password.
 */
@Controller("library-portal")
export class LibraryPortalController {
  constructor(private readonly portal: LibraryPortalService) {}

  @Public()
  @Post("login")
  login(@CurrentTenant() tenant: TenantContext, @Body() body: unknown) {
    const parsed = libraryPortalLoginSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.portal.login(tenant.schoolId, parsed.data);
  }

  @Roles(UserRole.STUDENT)
  @Get("me")
  me(@CurrentUser() me: AuthUser) {
    return this.portal.me(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("books")
  books(@CurrentUser() me: AuthUser) {
    return this.portal.listBooks(me.schoolId, me.userId);
  }

  @Roles(UserRole.STUDENT)
  @Get("books/:id")
  book(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.portal.getBook(me.schoolId, me.userId, id);
  }

  /**
   * Streams the PDF inline. There is no query param to force a download —
   * the frontend only offers a Download button when `allowDownload` is true,
   * and it builds that download itself from the same bytes (fetch + blob),
   * so "view only" isn't a second, easier-to-bypass endpoint.
   */
  @Roles(UserRole.STUDENT)
  @Get("books/:id/file")
  async bookFile(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Res() res: Response,
  ) {
    const { buffer, doc } = await this.portal.getBookFile(me.schoolId, me.userId, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(doc.title)}.pdf"`);
    res.send(buffer);
  }
}
