import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma, type User } from "@prisma/client";
import type { CreateUserInput, UpdateUserInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

/** Public shape of a user (never expose the password hash). */
function toDto(u: User) {
  return {
    id: u.id,
    schoolId: u.schoolId,
    username: u.username,
    role: u.role,
    status: u.status,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /** Create a user within the tenant. Runs under RLS (forTenant). */
  async create(schoolId: string, dto: CreateUserInput) {
    const passwordHash = await hashPassword(dto.password);
    try {
      const user = await this.prisma.forTenant(schoolId, (tx) =>
        tx.user.create({
          data: {
            schoolId,
            username: dto.username,
            role: dto.role,
            status: dto.status ?? "ACTIVE",
            passwordHash,
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

  async update(schoolId: string, id: string, dto: UpdateUserInput) {
    await this.findOne(schoolId, id); // 404s if not in this tenant
    const user = await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.update({
        where: { id },
        data: { role: dto.role, status: dto.status },
      }),
    );
    return toDto(user);
  }

  /** Admin password reset — also revokes the user's refresh tokens. */
  async resetPassword(schoolId: string, id: string, newPassword: string) {
    await this.findOne(schoolId, id);
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

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.delete({ where: { id } }),
    );
    return { success: true };
  }
}
