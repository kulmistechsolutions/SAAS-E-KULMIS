import {
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import type { CreateSchoolInput, UpdateSchoolInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { hashPassword } from "../auth/password.util";

function addDays(from: Date, days: number): Date {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return d;
}

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
        trialEndsAt: true,
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
        trialEndsAt: true,
        _count: { select: { users: true } },
      },
    });
    if (!school) throw new NotFoundException("School not found");
    return school;
  }

  /** Provision a new school (tenant) together with its first Administrator. */
  async create(dto: CreateSchoolInput) {
    const passwordHash = await hashPassword(dto.adminPassword);
    // Default to a 7-day trial so a new school can start immediately; an
    // explicit 0 means "no trial — blocked until a plan is assigned".
    const trialDays = dto.trialDays ?? 7;
    const trialEndsAt = trialDays > 0 ? addDays(new Date(), trialDays) : null;
    try {
      return await this.prisma.$transaction(async (tx) => {
        const school = await tx.school.create({
          data: {
            name: dto.name,
            subdomain: dto.subdomain.toLowerCase(),
            trialEndsAt,
          },
        });
        // The account provisioned for a new school is that school's OWNER, not
        // just an administrator — it gets the school-level Super Administrator
        // role (full access, and the only one that can see/manage that role
        // and the Danger Zone resets). The owner then creates Administrator
        // and other staff accounts under themselves.
        await tx.user.create({
          data: {
            schoolId: school.id,
            username: dto.adminUsername,
            role: "SUPER_ADMINISTRATOR",
            passwordHash,
          },
        });
        return {
          school: {
            id: school.id,
            name: school.name,
            subdomain: school.subdomain,
            status: school.status,
            trialEndsAt: school.trialEndsAt,
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
   * Extend or end a school's free trial. Counts from now, so this doubles as
   * "give them a few more days" after a trial has already lapsed.
   */
  async setTrial(schoolId: string, trialDays: number) {
    await this.findOne(schoolId);
    const trialEndsAt = trialDays > 0 ? addDays(new Date(), trialDays) : null;
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: { trialEndsAt },
      select: { id: true, name: true, trialEndsAt: true },
    });
    return school;
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
   * A school's sign-in trail, newest first — who signed in, when, from where,
   * and every failed attempt alongside. Lets the platform owner see whether a
   * school is actually being used, and spot a run of failures against one
   * account. Runs on the privileged connection with an explicit schoolId.
   */
  async schoolLoginActivity(schoolId: string, limit = 100) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { id: true, name: true },
    });
    if (!school) throw new NotFoundException("School not found");

    const take = Math.min(Math.max(limit, 1), 300);
    const [rows, totals] = await Promise.all([
      this.prisma.auditLog.findMany({
        where: { schoolId, module: "auth" },
        orderBy: { createdAt: "desc" },
        take,
        select: {
          id: true,
          username: true,
          role: true,
          action: true,
          ip: true,
          metadata: true,
          createdAt: true,
        },
      }),
      this.prisma.auditLog.groupBy({
        by: ["action"],
        where: { schoolId, module: "auth" },
        _count: { _all: true },
      }),
    ]);

    const countFor = (action: string) =>
      totals.find((t) => t.action === action)?._count._all ?? 0;

    // "Active" is measured from real sign-ins, so a school that never logs in
    // shows an empty trail rather than looking healthy.
    const lastLogin = rows.find((r) => r.action === "LOGIN")?.createdAt ?? null;

    return {
      school,
      summary: {
        successful: countFor("LOGIN"),
        failed: countFor("LOGIN_FAILED"),
        lastLoginAt: lastLogin,
      },
      rows: rows.map((r) => ({
        id: r.id,
        username: r.username,
        role: r.role,
        success: r.action === "LOGIN",
        ip: r.ip,
        reason: (r.metadata as { reason?: string } | null)?.reason ?? null,
        userAgent:
          (r.metadata as { userAgent?: string } | null)?.userAgent ?? null,
        at: r.createdAt,
      })),
    };
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
