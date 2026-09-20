import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { JwtService } from "@nestjs/jwt";
import { PrismaService } from "../prisma/prisma.service";
import { AuditService } from "../audit/audit.service";
import type { JwtPayload } from "../auth/auth.types";
import type { PlatformAdminCtx } from "./platform.types";

/** How long a support session lasts. Long enough to look, short enough to end. */
const MINUTES = 30;

/**
 * Signing in to a school as its administrator, from the platform console.
 *
 * Support without this means asking a school for its password — which teaches
 * schools that handing their password to someone claiming to be support is
 * normal, and leaves the platform owner holding credentials they can never
 * give back. It also meant a school locked out by an expired plan could not be
 * helped at all without one.
 *
 * The protections are what make it defensible, and none of them are optional:
 *
 *   - Platform owner only, behind PlatformGuard.
 *   - A reason is required. An audit line that says what was done but not why
 *     is a record nobody can act on.
 *   - Written to BOTH logs — the platform's and the SCHOOL'S OWN. A school can
 *     see, in its own audit trail, that the platform signed in to it and why.
 *     Support that a customer cannot see is surveillance.
 *   - Thirty minutes, and no refresh token. It ends by itself.
 *   - The token is marked `imp`, so the school's screens can say so and any
 *     future rule can refuse it.
 *
 * It deliberately does NOT bypass the school's own permissions: the session is
 * that administrator's, with exactly their rights, and nothing more.
 */
@Injectable()
export class SchoolSignInService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly audit: AuditService,
  ) {}

  async signInAs(
    schoolId: string,
    admin: PlatformAdminCtx,
    reason: string,
    ctx: { ip?: string | null } = {},
  ) {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      throw new BadRequestException(
        "Say why you are signing in to this school. It is written to the school's own audit trail.",
      );
    }

    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true, subdomain: true, status: true },
    });
    if (!school) throw new NotFoundException("School not found.");

    // The account whose rights the session carries. An administrator, never a
    // teacher or a bursar — support is a school-wide job — and the oldest one,
    // so the same person is picked every time and the audit trail reads
    // consistently rather than jumping between accounts.
    const user = await this.prisma.user.findFirst({
      where: {
        schoolId,
        status: "ACTIVE",
        role: { in: ["SUPER_ADMINISTRATOR", "ADMINISTRATOR"] },
      },
      orderBy: [{ role: "asc" }, { createdAt: "asc" }],
    });
    if (!user) {
      throw new BadRequestException(
        `${school.name} has no active administrator account to sign in as.`,
      );
    }

    const payload: JwtPayload = {
      sub: user.id,
      sid: user.schoolId,
      role: user.role,
      username: user.username,
      imp: admin.username,
      ...(user.customRoleId ? { crid: user.customRoleId } : {}),
    };
    const accessToken = await this.jwt.signAsync(payload, {
      expiresIn: MINUTES * 60,
    });

    // The school's own trail first: if writing the platform's copy fails, the
    // school still has the record. It is the one that matters.
    await this.audit.record({
      schoolId,
      userId: user.id,
      username: user.username,
      role: user.role,
      module: "Authentication",
      action: "Platform Support Sign-In",
      ip: ctx.ip ?? null,
      metadata: {
        platformAdmin: admin.username,
        reason: trimmed,
        expiresInMinutes: MINUTES,
      },
    });

    await this.prisma.platformAuditLog
      .create({
        data: {
          adminId: admin.adminId,
          username: admin.username,
          schoolId,
          module: "platform",
          action: "SCHOOL_SIGN_IN",
          newValue: {
            school: school.name,
            signedInAs: user.username,
            reason: trimmed,
            ip: ctx.ip ?? null,
          },
        },
      })
      .catch(() => undefined);

    return {
      accessToken,
      expiresInMinutes: MINUTES,
      school: {
        id: school.id,
        name: school.name,
        subdomain: school.subdomain,
        status: school.status,
      },
      signedInAs: { username: user.username, role: user.role },
    };
  }
}
