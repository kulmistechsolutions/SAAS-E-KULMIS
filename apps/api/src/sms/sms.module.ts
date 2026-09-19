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
import { ExaminationsModule } from "../examinations/examinations.module";
import { ExamResultSmsService } from "./exam-result-sms.service";
import { ExamResultSmsController } from "./exam-result-sms.controller";

@Module({
  imports: [
    // Sender ID applications carry a licence document.
    StorageModule,
    // Outstanding-fee reminders read the balance engine, not raw charges —
    // and finance calls back here when a payment is taken, so the two
    // modules genuinely point at each other.
    forwardRef(() => FinanceModule),
    // Exam-result SMS reads the same result sheet a school prints, rather
    // than recomputing marks here — and examinations already sends through
    // this module, so the two genuinely point at each other.
    forwardRef(() => ExaminationsModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
      }),
    }),
  ],
  controllers: [
    SmsController,
    PlatformSmsController,
    SmsPaymentController,
    ExamResultSmsController,
  ],
  providers: [
    SmsService,
    SmsAutoService,
    SmsPaymentService,
    SmsSenderIdService,
    ExamResultSmsService,
    PlatformGuard,
  ],
  exports: [SmsService, SmsAutoService, SmsPaymentService, ExamResultSmsService],
})
export class SmsModule {}
