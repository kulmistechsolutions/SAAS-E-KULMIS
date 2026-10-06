import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import {
  ASSIGNABLE_STAFF_ROLES,
  UserRole,
  type CreateUserInput,
  type UpdateUserInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";
import { PasswordPolicyService } from "../settings/password-policy.service";

function pad(n: number): string {
  return String(n).padStart(6, "0");
}

/** Public shape of a user (never expose the password hash). */
function toDto(u: User) {
  return {
    id: u.id,
    schoolId: u.schoolId,
    username: u.username,
    code: u.code,
    fullName: u.fullName,
    role: u.role,
    customRoleId: u.customRoleId ?? null,
    status: u.status,
    lastLoginAt: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwordPolicy: PasswordPolicyService,
  ) {}

  /** Create a user within the tenant. Runs under RLS (forTenant). */
  async create(schoolId: string, dto: CreateUserInput) {
    await this.passwordPolicy.assertAllowed(schoolId, dto.password);
    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.forTenant(schoolId, async (tx) => {
        const seq = await tx.counter.upsert({
          where: { schoolId_name: { schoolId, name: "user" } },
          create: { schoolId, name: "user", value: 1 },
          update: { value: { increment: 1 } },
        });
        return tx.user.create({
          data: {
            schoolId,
            username: dto.username,
            code: `USR-${pad(seq.value)}`,
            fullName: dto.fullName ?? dto.username,
            role: dto.role,
            status: dto.status ?? "ACTIVE",
            passwordHash,
          },
        });
      });
      return toDto(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Username already exists in this school");
      }
      throw e;
    }
  }

  async findAll(schoolId: string) {
    const users = await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.findMany({ orderBy: { username: "asc" } }),
    );
    return users.map(toDto);
  }

  async findOne(schoolId: string, id: string) {
    const user = await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.findFirst({ where: { id } }),
    );
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return toDto(user);
  }

  /**
   * The school's Super Administrator is its owner account: one per school,
   * made when the school was set up. Nobody in the school may make another,
   * take the role away, switch the account off, or delete it — and only the
   * owner may change it at all. Without this an Administrator could demote or
   * lock out the owner, and the owner could switch their own account off.
   */
  private guardOwner(
    target: { id: string; role: string },
    actorId: string,
    action: "edit" | "password" | "delete",
  ) {
    if (target.role !== UserRole.SUPER_ADMINISTRATOR) return;
    if (action === "delete") {
      throw new ForbiddenException(
        "The Super Administrator account cannot be deleted.",
      );
    }
    if (target.id !== actorId) {
      throw new ForbiddenException(
        "Only the Super Administrator can change their own account.",
      );
    }
  }

  async update(
    schoolId: string,
    id: string,
    dto: UpdateUserInput,
    actorId: string,
  ) {
    const current = await this.findOne(schoolId, id); // 404s if not in this tenant
    const isOwner = current.role === UserRole.SUPER_ADMINISTRATOR;
    this.guardOwner(current, actorId, "edit");
    // Saving the form sends the role back unchanged — that is not an
    // assignment. A different role must be one User Management hands out,
    // and the owner's own role is never changed.
    if (dto.role !== undefined && dto.role !== current.role) {
      if (isOwner || !ASSIGNABLE_STAFF_ROLES.includes(dto.role)) {
        throw new BadRequestException(
          "This role cannot be assigned through User Management.",
        );
      }
    }
    if (isOwner && dto.customRoleId) {
      throw new BadRequestException(
        "The Super Administrator keeps full access and cannot be put on a school role.",
      );
    }
    if (dto.status !== undefined && dto.status !== "ACTIVE") {
      if (isOwner) {
        throw new BadRequestException(
          "The Super Administrator account cannot be deactivated or locked.",
        );
      }
      if (id === actorId) {
        throw new BadRequestException(
          "You cannot deactivate or lock your own account.",
        );
      }
    }
    try {
      const user = await this.prisma.forTenant(schoolId, (tx) =>
        tx.user.update({
          where: { id },
          data: {
            username: dto.username,
            fullName: dto.fullName,
            role: dto.role,
            // undefined leaves it alone; null puts them back on the built-in
            // role, which is what "no custom role" has to mean.
            ...(dto.customRoleId === undefined
              ? {}
              : { customRoleId: dto.customRoleId }),
            status: dto.status,
          },
        }),
      );
      return toDto(user);
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException("Username already exists in this school");
      }
      throw e;
    }
  }

  /** Admin password reset — also revokes the user's refresh tokens. */
  async resetPassword(
    schoolId: string,
    id: string,
    newPassword: string,
    actorId: string,
  ) {
    this.guardOwner(await this.findOne(schoolId, id), actorId, "password");
    await this.passwordPolicy.assertAllowed(schoolId, newPassword);
    const passwordHash = await hashPassword(newPassword);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.update({ where: { id }, data: { passwordHash } }),
    );
    // Refresh tokens are system-level (no RLS) — revoke via the base client.
    await this.prisma.refreshToken.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { success: true };
  }

  async remove(schoolId: string, id: string, actorId: string) {
    this.guardOwner(await this.findOne(schoolId, id), actorId, "delete");
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.delete({ where: { id } }),
    );
    return { success: true };
  }
}
