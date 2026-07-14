import {
  MiddlewareConsumer,
  Module,
  NestModule,
  RequestMethod,
} from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { LoggerModule } from "nestjs-pino";
import { validateEnv } from "./config/env.validation";
import { AuthModule } from "./auth/auth.module";
import { AuditModule } from "./audit/audit.module";
import { HealthModule } from "./health/health.module";
import { PrismaModule } from "./prisma/prisma.module";
import { UsersModule } from "./users/users.module";
import { SettingsModule } from "./settings/settings.module";
import { AcademicsModule } from "./academics/academics.module";
import { StudentsModule } from "./students/students.module";
import { TeachersModule } from "./teachers/teachers.module";
import { AttendanceModule } from "./attendance/attendance.module";
import { FinanceModule } from "./finance/finance.module";
import { DashboardModule } from "./dashboard/dashboard.module";
import { PlatformModule } from "./platform/platform.module";
import { StorageModule } from "./storage/storage.module";
import { SearchModule } from "./search/search.module";
import { QueueModule } from "./queue/queue.module";
import { DocumentsModule } from "./documents/documents.module";
import { ExaminationsModule } from "./examinations/examinations.module";
import { PromotionsModule } from "./promotions/promotions.module";
import { QuizModule } from "./quiz/quiz.module";
import { AiModule } from "./ai/ai.module";
import { LibraryModule } from "./library/library.module";
import { ReportsModule } from "./reports/reports.module";
import { NotificationsModule } from "./notifications/notifications.module";
import { ParentPortalModule } from "./parent-portal/parent-portal.module";
import { TeacherPortalModule } from "./teacher-portal/teacher-portal.module";
import { BackupModule } from "./backup/backup.module";
import { ImportsModule } from "./imports/imports.module";
import { SmsModule } from "./sms/sms.module";
import { TenantMiddleware } from "./tenant/tenant.middleware";
import { TenantModule } from "./tenant/tenant.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: ["../../.env", ".env"],
      validate: validateEnv,
    }),
    LoggerModule.forRoot({
      pinoHttp: {
        transport:
          process.env.NODE_ENV !== "production"
            ? { target: "pino-pretty", options: { singleLine: true } }
            : undefined,
        autoLogging: true,
      },
    }),
    PrismaModule,
    QueueModule.forRoot(),
    DocumentsModule,
    AuditModule,
    StorageModule,
    SearchModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    AcademicsModule,
    StudentsModule,
    TeachersModule,
    AttendanceModule,
    FinanceModule,
    DashboardModule,
    ExaminationsModule,
    PromotionsModule,
    QuizModule,
    AiModule,
    LibraryModule,
    ReportsModule,
    NotificationsModule,
    ParentPortalModule,
    TeacherPortalModule,
    BackupModule,
    ImportsModule,
    SmsModule,
    PlatformModule,
    TenantModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer
      .apply(TenantMiddleware)
      .exclude(
        { path: "health", method: RequestMethod.ALL },
        { path: "", method: RequestMethod.ALL },
      )
      .forRoutes("*");
  }
}
