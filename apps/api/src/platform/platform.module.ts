import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { PlatformAuthController } from "./platform-auth.controller";
import { PlatformAuthService } from "./platform-auth.service";
import { SchoolsController } from "./schools.controller";
import { SchoolsService } from "./schools.service";
import { PlatformDashboardController } from "./platform-dashboard.controller";
import { PlatformService } from "./platform.service";
import { PlatformGuard } from "./platform.guard";

/** Platform (Super Admin) layer — manages all tenants, separate from schools. */
@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_TTL") ?? "15m") as unknown as number,
        },
      }),
    }),
  ],
  controllers: [
    PlatformAuthController,
    SchoolsController,
    PlatformDashboardController,
  ],
  providers: [
    PlatformAuthService,
    SchoolsService,
    PlatformService,
    PlatformGuard,
  ],
})
export class PlatformModule {}
