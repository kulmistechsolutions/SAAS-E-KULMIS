import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SmsService } from "./sms.service";
import { SmsController } from "./sms.controller";
import { PlatformSmsController } from "./platform-sms.controller";
import { SmsPaymentService } from "./sms-payment.service";
import { SmsPaymentController } from "./sms-payment.controller";
import { SmsSenderIdService } from "./sms-sender-id.service";
import { PlatformGuard } from "../platform/platform.guard";
import { StorageModule } from "../storage/storage.module";

@Module({
  imports: [
    // Sender ID applications carry a licence document.
    StorageModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [SmsController, PlatformSmsController, SmsPaymentController],
  providers: [SmsService, SmsPaymentService, SmsSenderIdService, PlatformGuard],
  exports: [SmsService, SmsPaymentService],
})
export class SmsModule {}
