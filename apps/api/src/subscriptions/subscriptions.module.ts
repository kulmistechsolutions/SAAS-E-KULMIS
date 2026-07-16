import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { ScheduleModule } from "@nestjs/schedule";
import {
  PlatformSubscriptionsController,
  SubscriptionsController,
} from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { PlatformGuard } from "../platform/platform.guard";
import { PlatformRolesGuard } from "../platform/platform-roles.guard";
import { NotificationsModule } from "../notifications/notifications.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    NotificationsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_TTL") ??
            "15m") as unknown as number,
        },
      }),
    }),
  ],
  controllers: [PlatformSubscriptionsController, SubscriptionsController],
  providers: [SubscriptionsService, PlatformGuard, PlatformRolesGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
