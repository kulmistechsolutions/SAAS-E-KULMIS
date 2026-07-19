import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateSchoolInput, UpdateSchoolInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

/**
 * School (tenant) management for the platform Super Admin. Runs on the
 * privileged connection (bypasses RLS) because the Super Admin operates across
 * ALL tenants — the opposite of the school-scoped services.
 */
@Injectable()
export class SchoolsService {
  constructor(private readonly prisma: PrismaService) {}

  /** Every school with headline counts. */
  findAll() {
    return this.prisma.school.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });
  }

  async findOne(id: string) {
    const school = await this.prisma.school.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
        createdAt: true,
        _count: { select: { users: true } },
      },
    });
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  /** Provision a new school (tenant) together with its first Administrator. */
  async create(dto: CreateSchoolInput) {
    const passwordHash = await hashPassword(dto.adminPassword);
    try {
      return await this.prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: { name: dto.name, subdomain: dto.subdomain.toLowerCase() },
        });
        await tx.user.create({
          data: {
            schoolId: school.id,
            username: dto.adminUsername,
            role: "ADMINISTRATOR",
            passwordHash,
          },
        });
        return {
          school: {
            id: school.id,
            name: school.name,
            subdomain: school.subdomain,
            status: school.status,
          },
          admin: { username: dto.adminUsername },
        };
      });
    } catch (e) {
      if (
        e instanceof Prisma.PrismaClientKnownRequestError &&
        e.code === "P2002"
      ) {
        throw new ConflictException(
          "That subdomain (or admin username) is already taken",
        );
      }
      throw e;
    }
  }

  async update(id: string, dto: UpdateSchoolInput) {
    await this.findOne(id);
    return this.prisma.school.update({
      where: { id },
      data: { name: dto.name, status: dto.status },
      select: {
        id: true,
        name: true,
        subdomain: true,
        status: true,
      },
    });
  }

  /** Permanently delete a school and all of its tenant data. */
  async remove(id: string) {
    await this.findOne(id);
    await this.prisma.$transaction(async (tx) => {
      // Remove data first that either blocks cascade (students hold RESTRICT
      // FKs to class/section) or isn't linked to the school by an FK.
      await tx.payment.deleteMany({ where: { schoolId: id } });
      await tx.feeCharge.deleteMany({ where: { schoolId: id } });
      await tx.studentAttendance.deleteMany({ where: { schoolId: id } });
      await tx.teacherAttendance.deleteMany({ where: { schoolId: id } });
      await tx.teacherAssignment.deleteMany({ where: { schoolId: id } });
      await tx.student.deleteMany({ where: { schoolId: id } });
      await tx.salary.deleteMany({ where: { schoolId: id } });
      await tx.expense.deleteMany({ where: { schoolId: id } });
      await tx.expenseCategory.deleteMany({ where: { schoolId: id } });
      await tx.auditLog.deleteMany({ where: { schoolId: id } });
      await tx.counter.deleteMany({ where: { schoolId: id } });
      // The rest cascades from the school: academicYears → classes → sections,
      // subjects, users → parents/teachers/refresh tokens.
      await tx.school.delete({ where: { id } });
    });
    return { success: true };
  }

  /**
   * The school's own staff logins, so Super Admin can help when an admin is
   * locked out. Password hashes are never returned.
   */
  async listSchoolUsers(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    if (!school) throw new NotFoundException("School not found");

    const users = await this.prisma.user.findMany({
      where: { schoolId },
      select: {
        id: true,
        username: true,
        role: true,
        status: true,
        lastLoginAt: true,
        createdAt: true,
      },
      orderBy: [{ role: "asc" }, { username: "asc" }],
    });
    return { school, users };
  }

  /**
   * Set a new password for one of the school's users. Only the password hash
   * is touched — no school data is read, changed or removed — and the user's
   * existing sessions are revoked so an old session can't outlive the reset.
   */
  async resetSchoolUserPassword(
    schoolId: string,
    userId: string,
    newPassword: string,
  ) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId, schoolId },
      select: { id: true, username: true, role: true },
    });
    // Scoped by schoolId too, so a userId from another tenant can't be hit.
    if (!user) throw new NotFoundException("User not found in this school");

    const passwordHash = await hashPassword(newPassword);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });
    await this.prisma.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    return { success: true, username: user.username, role: user.role };
  }
}
