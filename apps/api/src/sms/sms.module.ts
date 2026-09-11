import { forwardRef, Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { SmsService } from "./sms.service";
import { SmsAutoService } from "./sms-auto.service";
import { SmsController } from "./sms.controller";
import { PlatformSmsController } from "./platform-sms.controller";
import { SmsPaymentService } from "./sms-payment.service";
import { SmsPaymentController } from "./sms-payment.controller";
import { SmsSenderIdService } from "./sms-sender-id.service";
import { PlatformGuard } from "../platform/platform.guard";
import { StorageModule } from "../storage/storage.module";
import { FinanceModule } from "../finance/finance.module";

@Module({
  imports: [
    // Sender ID applications carry a licence document.
    StorageModule,
    // Outstanding-fee reminders read the balance engine, not raw charges —
    // and finance calls back here when a payment is taken, so the two
    // modules genuinely point at each other.
    forwardRef(() => FinanceModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [SmsController, PlatformSmsController, SmsPaymentController],
  providers: [
    SmsService,
    SmsAutoService,
    SmsPaymentService,
    SmsSenderIdService,
    PlatformGuard,
  ],
  exports: [SmsService, SmsAutoService, SmsPaymentService],
})
export class SmsModule {}
