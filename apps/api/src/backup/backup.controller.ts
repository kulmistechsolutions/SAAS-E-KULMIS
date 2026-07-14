import { Controller, Get, Post } from "@nestjs/common";
import { UserRole } from "@ekulmis/shared";
import { BackupService } from "./backup.service";
import { Roles } from "../auth/roles.decorator";
import { CurrentUser } from "../auth/current-user.decorator";
import type { AuthUser } from "../auth/auth.types";

@Roles(UserRole.ADMINISTRATOR)
@Controller("backup")
export class BackupController {
  constructor(private readonly backup: BackupService) {}

  @Get()
  list(@CurrentUser() me: AuthUser) {
    return this.backup.listJobs(me.schoolId);
  }

  @Post()
  create(@CurrentUser() me: AuthUser) {
    return this.backup.createJob(me.schoolId);
  }
}
