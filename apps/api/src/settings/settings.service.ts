import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import type { UpdateSettingsInput } from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import {
  SCHOOL_LOGO_MAX_BYTES,
  logoContentTypeFromKey,
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

  /**
   * Resolve a stored logoKey into a browser-usable signed URL when the
   * storage backend supports one (S3/Supabase/MinIO). Local filesystem
   * storage has no direct URL — callers fall back to streaming the bytes
   * through GET /settings/logo (see getLogoFile below).
   */
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

  /** Stream the raw logo bytes — used when the storage backend has no direct URL. */
  async getLogoFile(
    schoolId: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { logoKey: true },
    });
    if (!school?.logoKey) throw new NotFoundException("No logo set");
    // A school row can point at a file the storage backend no longer has (the
    // backend was switched, or the volume was replaced). That is a missing
    // logo, not a broken server — every page header asks for this, so a 500
    // here fills the log and shows an error where a blank crest belongs.
    let buffer: Buffer;
    try {
      buffer = await this.storage.getObject(this.bucket, school.logoKey);
    } catch (err) {
      const code = (err as { code?: string } | null)?.code;
      if (code === "ENOENT" || code === "NoSuchKey") {
        throw new NotFoundException("No logo set");
      }
      throw err;
    }
    return { buffer, contentType: logoContentTypeFromKey(school.logoKey) };
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
        documentHeaderLayout: true,
        // The login screen is the one page every school opens daily and the
        // only one an anonymous visitor sees first — it has to be able to
        // show that school's own title, footer and colours, not the
        // product's defaults, so they belong in the public payload.
        brandLoginTitle: true,
        brandFooterText: true,
        primaryColor: true,
        secondaryColor: true,
        accentColor: true,
        // Which self-service entrances this school actually opened. Staff
        // login is where parents and students keep landing by mistake, and
        // it can only point them somewhere better if it knows what exists.
        // Not sensitive: visiting the portal would reveal the same thing.
        studentPortalEnabled: true,
        examSettings: true,
      },
    });
    if (!school) {
      throw new NotFoundException("School not found");
    }
    const exams = school.examSettings as { publicResultPortal?: boolean } | null;
    const { examSettings: _examSettings, ...rest } = school;
    return {
      ...this.attachLogoUrl(rest),
      portals: {
        student: school.studentPortalEnabled,
        // Defaults to on, matching ExaminationsService.toggles().
        publicResults: exams?.publicResultPortal ?? true,
      },
    };
  }

  /**
   * Every JSON-valued settings column. Prisma will not take a bare `null` for
   * a Json field — clearing one back to "school never customised this page"
   * needs Prisma.JsonNull — so each has to be lifted out of the spread and
   * translated. Listing them here keeps that in one place: a new settings
   * section only has to be named, not re-implemented.
   */
  private static readonly JSON_SETTINGS = [
    "gradeBands",
    "attendanceSettings",
    "examSettings",
    "quizSettings",
    "academicSettings",
    "salarySettings",
    "expenseSettings",
    "notificationSettings",
    "securitySettings",
  ] as const;

  async update(schoolId: string, dto: UpdateSettingsInput) {
    const rest: Record<string, unknown> = { ...dto };
    const jsonData: Record<string, unknown> = {};
    for (const key of SettingsService.JSON_SETTINGS) {
      if (!(key in dto)) continue;
      const value = (dto as Record<string, unknown>)[key];
      delete rest[key];
      jsonData[key] = value ?? Prisma.JsonNull;
    }

    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: { ...rest, ...jsonData } as Prisma.SchoolUpdateInput,
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
      await this.storage
        .removeObject(this.bucket, existing.logoKey)
        .catch(() => undefined);
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
      await this.storage
        .removeObject(this.bucket, existing.logoKey)
        .catch(() => undefined);
    }
    const school = await this.prisma.school.update({
      where: { id: schoolId },
      data: { logoKey: null },
    });
    return this.attachLogoUrl(school);
  }
}
