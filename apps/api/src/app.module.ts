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
import { StorageModule } from "./storage/storage.module";
import { SearchModule } from "./search/search.module";
import { TenantMiddleware } from "./tenant/tenant.middleware";
import { TenantModule } from "./tenant/tenant.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      // Load the monorepo-root .env (relative to apps/api cwd) then a local one.
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
    AuditModule,
    StorageModule,
    SearchModule,
    AuthModule,
    UsersModule,
    SettingsModule,
    AcademicsModule,
    TenantModule,
    HealthModule,
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Resolve the tenant on every request except the infra health check.
    consumer
      .apply(TenantMiddleware)
      .exclude({ path: "health", method: RequestMethod.ALL })
      .forRoutes("*");
  }
}
