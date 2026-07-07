import { Controller, Get, UseGuards } from "@nestjs/common";
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
}
