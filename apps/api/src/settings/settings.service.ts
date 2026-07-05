import { Injectable, NotFoundException } from "@nestjs/common";
import type { UpdateSettingsInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";

/**
 * School settings & branding (Module 16). The `schools` table is the tenant
 * registry (no RLS); every operation is scoped by the authenticated schoolId,
 * so `where: { id: schoolId }` is inherently tenant-safe.
 */
@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async get(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException("School not found");
    }
    return school;
  }

  /** Public branding subset (used by the login page, resolved by subdomain). */
  async getBranding(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: {
        name: true,
        motto: true,
        logoKey: true,
        currency: true,
        language: true,
        timezone: true,
      },
    });
    if (!school) {
      throw new NotFoundException("School not found");
    }
    return school;
  }

  async update(schoolId: string, dto: UpdateSettingsInput) {
    return this.prisma.school.update({ where: { id: schoolId }, data: dto });
  }
}
