import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import {
  PlatformSubscriptionsController,
  SubscriptionsController,
} from "./subscriptions.controller";
import { SubscriptionsService } from "./subscriptions.service";
import { PlatformGuard } from "../platform/platform.guard";

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
  controllers: [PlatformSubscriptionsController, SubscriptionsController],
  providers: [SubscriptionsService, PlatformGuard],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
