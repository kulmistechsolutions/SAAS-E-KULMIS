import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { UpdateSettingsInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import {
  SCHOOL_LOGO_MAX_BYTES,
  logoExtension,
  schoolLogoKey,
  type SchoolLogoMime,
} from "./school-logo.util";

/**
 * School settings & branding (Module 16). The `schools` table is the tenant
 * registry (no RLS); every operation is scoped by the authenticated schoolId,
 * so `where: { id: schoolId }` is inherently tenant-safe.
 */
@Injectable()
export class SettingsService {
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
      this.config.get<string>("MINIO_BUCKET") ??
      "ekulmis";
  }

  /** Resolve a stored logoKey into a browser-usable signed URL. */
  private async attachLogoUrl<T extends { logoKey: string | null }>(
    school: T,
  ): Promise<T & { logoUrl: string | null }> {
    if (!school.logoKey) return { ...school, logoUrl: null };
    try {
      const logoUrl = await this.storage.getSignedUrl(
        this.bucket,
        school.logoKey,
        3600,
      );
      return { ...school, logoUrl };
    } catch {
      return { ...school, logoUrl: null };
    }
  }

  async get(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
    });
    if (!school) {
      throw new NotFoundException("School not found");
    }
    return this.attachLogoUrl(school);
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
    return this.attachLogoUrl(school);
  }

  async update(schoolId: string, dto: UpdateSettingsInput) {
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: dto,
    });
    return this.attachLogoUrl(school);
  }

  async uploadLogo(schoolId: string, buffer: Buffer, mime: SchoolLogoMime) {
    if (buffer.length > SCHOOL_LOGO_MAX_BYTES) {
      throw new BadRequestException("Logo must be under 2 MB");
    }
    const existing = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { logoKey: true },
    });
    if (!existing) throw new NotFoundException("School not found");

    const key = schoolLogoKey(schoolId, logoExtension(mime));
    await this.storage.putObject(this.bucket, key, buffer, mime);
    if (existing.logoKey && existing.logoKey !== key) {
      await this.storage.removeObject(this.bucket, existing.logoKey).catch(() => undefined);
    }
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: { logoKey: key },
    });
    return this.attachLogoUrl(school);
  }

  async removeLogo(schoolId: string) {
    const existing = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { logoKey: true },
    });
    if (!existing) throw new NotFoundException("School not found");
    if (existing.logoKey) {
      await this.storage.removeObject(this.bucket, existing.logoKey).catch(() => undefined);
    }
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: { logoKey: null },
    });
    return this.attachLogoUrl(school);
  }
}
