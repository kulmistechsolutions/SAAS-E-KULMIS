import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { PlatformGuard } from "./platform.guard";
import { Public } from "../auth/public.decorator";

@Public()
@UseGuards(PlatformGuard)
@Controller("platform/dashboard")
export class PlatformDashboardController {
  constructor(private readonly platform: PlatformService) {}

  @Get()
  dashboard() {
    return this.platform.dashboard();
  }

  @Get("error-logs")
  errorLogs(
    @Query("schoolId") schoolId?: string,
    @Query("days") days?: string,
    @Query("limit") limit?: string,
  ) {
    return this.platform.errorLogs({
      schoolId: schoolId || undefined,
      days: days ? Number(days) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }
}
