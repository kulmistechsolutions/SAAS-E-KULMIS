import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SmsService } from "./sms.service";
import { SmsController } from "./sms.controller";
import { PlatformSmsController } from "./platform-sms.controller";
import { SmsPaymentService } from "./sms-payment.service";
import { SmsPaymentController } from "./sms-payment.controller";
import { PlatformGuard } from "../platform/platform.guard";

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [SmsController, PlatformSmsController, SmsPaymentController],
  providers: [SmsService, SmsPaymentService, PlatformGuard],
  exports: [SmsService, SmsPaymentService],
})
export class SmsModule {}
