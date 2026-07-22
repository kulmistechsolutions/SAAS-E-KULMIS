import { Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateParentInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

/** The password every parent account starts on, and the reset falls back to. */
const DEFAULT_PARENT_PASSWORD = "12345";

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Reset the linked parent portal login. Persists a fresh password to the
   * parent's User account (previously the UI only generated one locally, so the
   * parent could never actually log in with it) and revokes old sessions.
   */
  async resetPassword(schoolId: string, id: string, customPassword?: string) {
    const parent = await this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findFirst({ where: { id }, select: { userId: true } }),
    );
    if (!parent) throw new NotFoundException("Parent not found");

    // Reset lands the parent on the shared default (12345) so the front desk
    // can just tell them, unless the admin typed a specific password to set.
    const password = customPassword?.trim() || DEFAULT_PARENT_PASSWORD;
    const passwordHash = await hashPassword(password);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.user.update({
        where: { id: parent.userId },
        data: { passwordHash },
      }),
    );
    // Refresh tokens are system-level (no RLS) — revoke via the base client.
    await this.prisma.refreshToken.updateMany({
      where: { userId: parent.userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { password };
  }

  async update(schoolId: string, id: string, dto: UpdateParentInput) {
    const existing = await this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findFirst({ where: { id }, select: { id: true } }),
    );
    if (!existing) throw new NotFoundException("Parent not found");
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.update({
        where: { id },
        data: {
          name: dto.name,
          phone: dto.phone,
          altPhone: dto.altPhone,
          email: dto.email,
          address: dto.address,
          occupation: dto.occupation,
          status: dto.status,
        },
      }),
    );
  }

  findAll(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { students: true } } },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const parent = await this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findFirst({
        where: { id },
        include: {
          students: {
            select: { id: true, code: true, fullName: true, status: true },
          },
        },
      }),
    );
    if (!parent) throw new NotFoundException("Parent not found");
    return parent;
  }
}
