import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Query,
} from "@nestjs/common";
import { z } from "zod";
import { UserRole } from "@ekulmis/shared";
import { AcademicYearTransferService } from "./academic-year-transfer.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

const transferQuerySchema = z.object({
  fromYearId: z.string().min(1, "fromYearId is required"),
  toYearId: z.string().min(1, "toYearId is required"),
});

/** Correct students registered under the wrong academic year — not promotion. */
@Roles(UserRole.ADMINISTRATOR)
@Controller("students/academic-year-transfer")
export class AcademicYearTransferController {
  constructor(private readonly transfer: AcademicYearTransferService) {}

  @Get("preview")
  preview(
    @CurrentUser() me: AuthUser,
    @Query("fromYearId") fromYearId?: string,
    @Query("toYearId") toYearId?: string,
  ) {
    const parsed = transferQuerySchema.safeParse({ fromYearId, toYearId });
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.transfer.preview(
      me.schoolId,
      parsed.data.fromYearId,
      parsed.data.toYearId,
    );
  }

  @Post()
  execute(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = transferQuerySchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.transfer.execute(
      me.schoolId,
      parsed.data.fromYearId,
      parsed.data.toYearId,
    );
  }
}
