import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { AiService } from "./ai.service";
import { PlatformAiController } from "./platform-ai.controller";
import { PlatformGuard } from "../platform/platform.guard";

@Module({
  imports: [
    // Needed so PlatformGuard (super-admin JWT) can resolve JwtService here.
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [PlatformAiController],
  providers: [AiService, PlatformGuard],
  exports: [AiService],
})
export class AiModule {}
