import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { PlatformService } from "./platform.service";
import { DataHealthService } from "./data-health.service";
import { PlatformGuard } from "./platform.guard";
import { Public } from "../auth/public.decorator";

@Public()
@UseGuards(PlatformGuard)
@Controller("platform/dashboard")
export class PlatformDashboardController {
  constructor(
    private readonly platform: PlatformService,
    private readonly dataHealth: DataHealthService,
  ) {}

  @Get()
  dashboard() {
    return this.platform.dashboard();
  }

  /** Which schools are actually using the system, and which have gone quiet. */
  @Get("school-activity")
  schoolActivity(@Query("days") days?: string) {
    return this.platform.schoolActivity({
      days: days ? Number(days) : undefined,
    });
  }

  @Get("school-activity/:schoolId")
  schoolActivityDetail(
    @Param("schoolId") schoolId: string,
    @Query("days") days?: string,
  ) {
    return this.platform.schoolActivityDetail(schoolId, {
      days: days ? Number(days) : undefined,
    });
  }

  /** Standing invariants — the faults that never raise an error. */
  @Get("data-health")
  dataHealthReport() {
    return this.dataHealth.run();
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
