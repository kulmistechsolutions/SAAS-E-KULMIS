import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";
import { CardDesignsService, saveCardDesignSchema } from "./card-designs.service";

/**
 * Saved ID-card layouts, shared across a school.
 *
 * Reading is open to every role that can reach the ID Generator, so an exam
 * officer printing exam cards gets the school's agreed layout. Writing is
 * limited to admins and exam managers — a card design is school-wide, so a
 * careless edit would change what everyone prints.
 */
@Roles(
  UserRole.ADMINISTRATOR,
  UserRole.SUPER_ADMINISTRATOR,
  UserRole.EXAM_MANAGER,
  UserRole.ACADEMIC_MANAGER,
  UserRole.RECEPTION_OFFICER,
  UserRole.RECEPTION,
)
@Controller("card-designs")
export class CardDesignsController {
  constructor(private readonly designs: CardDesignsService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.designs.list(me.schoolId);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Post()
  save(@CurrentUser() me: AuthUser, @Body() body: unknown) {
    const parsed = saveCardDesignSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException(parsed.error.flatten());
    return this.designs.save(me.schoolId, me.userId, parsed.data);
  }

  @Roles(UserRole.ADMINISTRATOR, UserRole.SUPER_ADMINISTRATOR, UserRole.EXAM_MANAGER)
  @Delete(":designKey")
  remove(@CurrentUser() me: AuthUser, @Param("designKey") designKey: string) {
    return this.designs.remove(me.schoolId, decodeURIComponent(designKey));
  }
}
