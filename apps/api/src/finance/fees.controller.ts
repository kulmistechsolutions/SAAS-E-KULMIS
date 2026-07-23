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
  chargeMonthSchema,
  createExtraFeeSchema,
  payFeeSchema,
  setupAcademicYearFeesSchema,
  setupMonthSchema,
  updateExtraFeeSchema,
  UserRole,
} from "@ekulmis/shared";
import { FeesService } from "./fees.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR, UserRole.FINANCE_OFFICER)
@Controller("fees")
export class FeesController {
  constructor(private readonly fees: FeesService) {}

  @Get("settings")
  settings(@CurrentUser() me: AuthUser) {
    return this.fees.getSettings(me.schoolId);
  }

  @Post("setup-academic-year")
  setupAcademicYear(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = setupAcademicYearFeesSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.setupAcademicYear(me.schoolId, parsed.data);
  }

  @Post("charge")
  charge(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = chargeMonthSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.chargeMonth(me.schoolId, parsed.data);
  }

  /** Monthly fee setup — turn billing on for a month, all or chosen classes. */
  @Post("setup-month")
  setupMonth(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = setupMonthSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.setupMonth(me.schoolId, parsed.data);
  }

  /** Which classes are set up (activated) for a given month. */
  @Get("month-status")
  monthStatus(
    @CurrentUser() me: AuthUser,
    @Query("year") year: string,
    @Query("month") month: string,
  ) {
    const y = Number(year);
    const m = Number(month);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      throw new BadRequestException("Valid year and month are required");
    }
    return this.fees.monthSetupStatus(me.schoolId, y, m);
  }

  @Post("pay")
  pay(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = payFeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.pay(me.schoolId, parsed.data, me.userId);
  }

  @Get("ledger/:studentId")
  ledger(@CurrentUser() me: AuthUser, @Param("studentId") studentId: string) {
    return this.fees.ledger(me.schoolId, studentId);
  }

  @Get("outstanding")
  outstanding(
    @CurrentUser() me: AuthUser,
    @Query("classId") classId?: string,
    @Query("sectionId") sectionId?: string,
  ) {
    return this.fees.outstanding(me.schoolId, classId, sectionId);
  }

  @Get("payments")
  payments(@CurrentUser() me: AuthUser, @Query("limit") limit?: string) {
    return this.fees.listPayments(me.schoolId, limit ? Number(limit) : 100);
  }

  @Get("charges")
  charges(
    @CurrentUser() me: AuthUser,
    @Query("year") year?: string,
    @Query("month") month?: string,
  ) {
    return this.fees.listCharges(
      me.schoolId,
      year ? Number(year) : undefined,
      month ? Number(month) : undefined,
    );
  }

  // ── Extra fees ──
  @Get("extra")
  listExtraFees(@CurrentUser() me: AuthUser) {
    return this.fees.listExtraFees(me.schoolId);
  }

  @Post("extra")
  createExtraFee(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = createExtraFeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.createExtraFee(me.schoolId, parsed.data, me.userId);
  }

  @Patch("extra/:id")
  updateExtraFee(
    @CurrentUser() me: AuthUser,
    @Param("id") id: string,
    @Body() body: unknown,
  ) {
    const parsed = updateExtraFeeSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.fees.updateExtraFee(me.schoolId, id, parsed.data);
  }

  @Delete("extra/:id")
  deleteExtraFee(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.fees.deleteExtraFee(me.schoolId, id);
  }

  /** Who would be charged and how much, before actually billing it. */
  @Get("extra/:id/preview")
  previewExtraFee(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.fees.previewExtraFee(me.schoolId, id);
  }

  @Post("extra/:id/apply")
  applyExtraFee(@CurrentUser() me: AuthUser, @Param("id") id: string) {
    return this.fees.applyExtraFee(me.schoolId, id);
  }
}
