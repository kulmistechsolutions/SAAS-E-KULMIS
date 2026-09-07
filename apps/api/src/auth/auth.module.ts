import { Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { SubscriptionsModule } from "../subscriptions/subscriptions.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { JwtAuthGuard } from "./jwt-auth.guard";
import { RolesGuard } from "./roles.guard";
import { PermissionsGuard } from "./permissions.guard";

@Module({
  imports: [
    // Login checks the school's trial/subscription state before issuing tokens.
    SubscriptionsModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_ACCESS_SECRET"),
        // `expiresIn` accepts a duration string like "15m" at runtime; cast to
        // satisfy @nestjs/jwt's stricter `ms` StringValue typing.
        signOptions: {
          expiresIn: (config.get<string>("JWT_ACCESS_TTL") ?? "15m") as unknown as number,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    // Global auth + RBAC. JwtAuthGuard runs first, then RolesGuard.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    // Runs after RolesGuard, and only bites on routes carrying
    // @RequirePermission — so a school's own override is enforced without
    // every existing route having to be re-declared at once.
    { provide: APP_GUARD, useClass: PermissionsGuard },
  ],
  exports: [AuthService],
})
export class AuthModule {}
