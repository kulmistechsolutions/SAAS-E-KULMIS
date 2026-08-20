import { Global, Module } from "@nestjs/common";
import { SettingsController } from "./settings.controller";
import { SettingsService } from "./settings.service";
import { PasswordPolicyService } from "./password-policy.service";

/**
 * Global because the password policy is enforced wherever a password is
 * chosen — users, teachers, parents, students, auth — and threading an
 * import through every one of those modules buys nothing.
 */
@Global()
@Module({
  controllers: [SettingsController],
  providers: [SettingsService, PasswordPolicyService],
  exports: [SettingsService, PasswordPolicyService],
})
export class SettingsModule {}
