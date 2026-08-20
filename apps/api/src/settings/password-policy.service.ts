import { BadRequestException, Injectable } from "@nestjs/common";
import {
  DEFAULT_PASSWORD_POLICY,
  passwordPolicyMessage,
  type PasswordPolicy,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * Enforces the password rules a school sets in Settings → Security.
 *
 * Only passwords a person chooses go through here. The ones the system
 * issues to itself — a student's ID as their first portal password, a
 * school's default parent password — are deliberately exempt: they are not
 * typed by anyone, and holding them to a length or symbol rule would block
 * registering a student rather than protect an account.
 */
@Injectable()
export class PasswordPolicyService {
  constructor(private readonly prisma: PrismaService) {}

  /** A school's rules, or the platform defaults when it has set none. */
  async forSchool(schoolId: string): Promise<PasswordPolicy> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { securitySettings: true },
    });
    const stored = school?.securitySettings as Partial<PasswordPolicy> | null;
    if (!stored) return DEFAULT_PASSWORD_POLICY;
    return {
      minPasswordLength:
        stored.minPasswordLength ?? DEFAULT_PASSWORD_POLICY.minPasswordLength,
      requireComplexity:
        stored.requireComplexity ?? DEFAULT_PASSWORD_POLICY.requireComplexity,
      requireUppercase:
        stored.requireUppercase ?? DEFAULT_PASSWORD_POLICY.requireUppercase,
      requireNumber:
        stored.requireNumber ?? DEFAULT_PASSWORD_POLICY.requireNumber,
    };
  }

  /** Throws a 400 naming every rule the password breaks. */
  async assertAllowed(schoolId: string, password: string): Promise<void> {
    const message = passwordPolicyMessage(
      password,
      await this.forSchool(schoolId),
    );
    if (message) throw new BadRequestException(message);
  }
}
