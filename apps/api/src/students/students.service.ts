import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma } from "@prisma/client";
import type {
  RegisterStudentInput,
  UpdateStudentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { FeesService } from "../finance/fees.service";
import { hashPassword } from "../auth/password.util";
import {
  assertStudentPhotoMime,
  photoContentTypeFromKey,
  photoExtension,
  STUDENT_PHOTO_MAX_BYTES,
  studentPhotoKey,
} from "./student-photo.util";

function pad(n: number): string {
  return String(n).padStart(4, "0");
}

const DEFAULT_PARENT_PASSWORD = "12345";

const studentInclude = {
  parent: {
    select: {
      id: true,
      code: true,
      name: true,
      phone: true,
      altPhone: true,
      email: true,
      address: true,
      occupation: true,
      status: true,
      createdAt: true,
    },
  },
  class: {
    select: {
      id: true,
      name: true,
      academicYearId: true,
      academicYear: { select: { name: true } },
    },
  },
  section: { select: { id: true, name: true } },
} satisfies Prisma.StudentInclude;

type StudentRow = Prisma.StudentGetPayload<{ include: typeof studentInclude }>;

export type StudentWithPhoto = StudentRow & {
  hasPhoto: boolean;
  photoUrl: string | null;
};

@Injectable()
export class StudentsService {
  private readonly logger = new Logger(StudentsService.name);
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly fees: FeesService,
  ) {
    this.bucket =
      this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
      this.config.get<string>("MINIO_BUCKET") ??
      "ekulmis";
  }

  private async attachPhotoMeta(student: StudentRow): Promise<StudentWithPhoto> {
    const hasPhoto = !!student.photoKey;
    if (!hasPhoto || !student.photoKey) {
      return { ...student, hasPhoto: false, photoUrl: null };
    }
    try {
      const photoUrl = await this.storage.getSignedUrl(
        this.bucket,
        student.photoKey,
        3600,
      );
      this.logger.debug(
        `Photo URL for student ${student.id}: key=${student.photoKey} url=${photoUrl.slice(0, 80)}…`,
      );
      return { ...student, hasPhoto: true, photoUrl };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to resolve photo URL for student ${student.id} (key=${student.photoKey}): ${message}`,
      );
      return { ...student, hasPhoto: true, photoUrl: null };
    }
  }

  private async attachPhotoMetas(
    students: StudentRow[],
  ): Promise<StudentWithPhoto[]> {
    return Promise.all(students.map((s) => this.attachPhotoMeta(s)));
  }

  private async removePhotoObject(key: string | null | undefined): Promise<void> {
    if (!key) return;
    try {
      await this.storage.removeObject(this.bucket, key);
      this.logger.log(`Removed storage object bucket=${this.bucket} key=${key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Failed to remove storage object key=${key}: ${message}`);
    }
  }

  /**
   * Register a student. Auto-creates the parent (reused by phone), auto-assigns
   * sequential Student/Parent IDs from the school prefixes, prevents duplicates,
   * and validates the class/section — all in one tenant transaction.
   */
  async register(schoolId: string, dto: RegisterStudentInput) {
    const result = await this.prisma.forTenant(schoolId, async (tx) => {
      const school = await tx.school.findUnique({
        where: { id: schoolId },
        select: { studentPrefix: true, parentPrefix: true },
      });
      if (!school) throw new NotFoundException("School not found");

      const cls = await tx.class.findFirst({
        where: { id: dto.classId },
        select: { id: true },
      });
      if (!cls) throw new BadRequestException("Invalid class");

      const sectionId = dto.sectionId ?? null;
      if (sectionId) {
        const sec = await tx.section.findFirst({
          where: { id: sectionId, classId: dto.classId },
          select: { id: true },
        });
        if (!sec) {
          throw new BadRequestException("Invalid section for this class");
        }
      }

      let parent = await tx.parent.findFirst({
        where: { phone: dto.parentPhone },
      });
      let initialParentPassword: string | undefined;
      if (!parent) {
        const seq = await tx.counter.upsert({
          where: { schoolId_name: { schoolId, name: "parent" } },
          create: { schoolId, name: "parent", value: 1 },
          update: { value: { increment: 1 } },
        });
        const parentCode = `${school.parentPrefix}${pad(seq.value)}`;
        initialParentPassword = DEFAULT_PARENT_PASSWORD;
        const user = await tx.user.create({
          data: {
            schoolId,
            username: parentCode,
            role: "PARENT",
            passwordHash: await hashPassword(initialParentPassword),
          },
        });
        parent = await tx.parent.create({
          data: {
            schoolId,
            code: parentCode,
            name: dto.parentName,
            phone: dto.parentPhone,
            userId: user.id,
          },
        });
      }

      const dup = await tx.student.findFirst({
        where: {
          fullName: dto.fullName,
          parentId: parent.id,
          classId: dto.classId,
          sectionId,
        },
        select: { id: true },
      });
      if (dup) {
        throw new ConflictException(
          "A student with the same name, parent, class and section already exists",
        );
      }

      const seq = await tx.counter.upsert({
        where: { schoolId_name: { schoolId, name: "student" } },
        create: { schoolId, name: "student", value: 1 },
        update: { value: { increment: 1 } },
      });
      const code = `${school.studentPrefix}${pad(seq.value)}`;
      const portalPasswordHash = await hashPassword(code);

      const student = await tx.student.create({
        data: {
          schoolId,
          code,
          fullName: dto.fullName,
          gender: dto.gender,
          dob: dto.dob ?? null,
          phone: dto.phone ?? null,
          notes: dto.notes ?? null,
          portalPasswordHash,
          parentId: parent.id,
          classId: dto.classId,
          sectionId,
          monthlyFee: dto.monthlyFee ?? 0,
          feeStartMode: dto.feeStartMode ?? null,
          feeAgreementAmount: dto.agreementAmount ?? null,
        },
        include: studentInclude,
      });

      return {
        student,
        parentCreated: initialParentPassword !== undefined,
        initialParentPassword,
      };
    });

    const student = await this.attachPhotoMeta(result.student);
    try {
      await this.fees.initializeStudentFees(schoolId, student.id, {
        feeStartMode: dto.feeStartMode,
        agreementAmount: dto.agreementAmount,
      });
    } catch (err) {
      this.logger.warn(
        `Fee initialization skipped for ${student.code}: ${err instanceof Error ? err.message : err}`,
      );
    }
    this.logger.log(
      `Registered student ${student.code} (${student.id}) in school ${schoolId}`,
    );
    return {
      ...result,
      student,
    };
  }

  async findAll(
    schoolId: string,
    filters: {
      classId?: string;
      sectionId?: string;
      status?: string;
      gender?: string;
    } = {},
    opts: { includePhotoUrls?: boolean } = {},
  ) {
    const rows = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findMany({
        where: {
          classId: filters.classId,
          sectionId: filters.sectionId,
          status: filters.status as never,
          gender: filters.gender as never,
        },
        orderBy: { fullName: "asc" },
        include: studentInclude,
      }),
    );
    if (opts.includePhotoUrls === false) {
      return rows.map((s) => ({
        ...s,
        hasPhoto: !!s.photoKey,
        photoUrl: null,
      }));
    }
    return this.attachPhotoMetas(rows);
  }

  async findOne(schoolId: string, id: string) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({ where: { id }, include: studentInclude }),
    );
    if (!student) throw new NotFoundException("Student not found");
    return this.attachPhotoMeta(student);
  }

  async getPhoto(
    schoolId: string,
    id: string,
  ): Promise<{ buffer: Buffer; contentType: string }> {
    const row = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({
        where: { id },
        select: { photoKey: true },
      }),
    );
    if (!row?.photoKey) {
      throw new NotFoundException("Student photo not found");
    }
    try {
      const buffer = await this.storage.getObject(this.bucket, row.photoKey);
      return {
        buffer,
        contentType: photoContentTypeFromKey(row.photoKey),
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(
        `Failed to read photo for student ${id} (key=${row.photoKey}): ${message}`,
      );
      throw new ServiceUnavailableException(
        "Photo storage is unavailable. Check Supabase Storage configuration (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
      );
    }
  }

  async uploadPhoto(
    schoolId: string,
    id: string,
    buffer: Buffer,
    mimeType: string,
  ): Promise<StudentWithPhoto> {
    const mime = assertStudentPhotoMime(mimeType);
    if (buffer.length > STUDENT_PHOTO_MAX_BYTES) {
      throw new BadRequestException("Photo must be under 2 MB.");
    }
    if (buffer.length === 0) {
      throw new BadRequestException("Photo file is empty.");
    }

    const existing = await this.findOne(schoolId, id);
    const ext = photoExtension(mime);
    const key = studentPhotoKey(schoolId, id, ext);

    try {
      if (existing.photoKey && existing.photoKey !== key) {
        await this.removePhotoObject(existing.photoKey);
      }
      this.logger.log(
        `Photo upload: student=${id} bucket=${this.bucket} key=${key} bytes=${buffer.length} mime=${mime}`,
      );
      await this.storage.putObject(this.bucket, key, buffer, mime);
      this.logger.log(`Photo upload stored: student=${id} key=${key}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error(`Photo upload failed for student ${id}: ${message}`);
      throw new ServiceUnavailableException(
        "Photo storage is unavailable. Check Supabase Storage configuration (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).",
      );
    }

    const updated = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.update({
        where: { id },
        data: { photoKey: key },
        include: studentInclude,
      }),
    );
    this.logger.log(`Photo key saved in DB: student=${id} photoKey=${key}`);
    const withUrl = await this.attachPhotoMeta(updated);
    this.logger.log(
      `Photo URL generated: student=${id} hasPhoto=${withUrl.hasPhoto} url=${withUrl.photoUrl ? withUrl.photoUrl.slice(0, 120) : "null"}`,
    );
    return withUrl;
  }

  async deletePhoto(schoolId: string, id: string): Promise<StudentWithPhoto> {
    const existing = await this.findOne(schoolId, id);
    await this.removePhotoObject(existing.photoKey);

    const updated = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.update({
        where: { id },
        data: { photoKey: null },
        include: studentInclude,
      }),
    );
    this.logger.log(`Removed photo for student ${id}`);
    return this.attachPhotoMeta(updated);
  }

  async attendanceHistory(schoolId: string, studentId: string, limit = 60) {
    await this.findOne(schoolId, studentId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const records = await tx.studentAttendance.findMany({
        where: { studentId },
        orderBy: { date: "desc" },
        take: limit,
      });
      let present = 0;
      let absent = 0;
      let late = 0;
      for (const r of records) {
        if (r.status === "PRESENT") present++;
        else if (r.status === "ABSENT") absent++;
        else if (r.status === "LATE") late++;
      }
      const total = present + absent + late || 1;
      return {
        present,
        absent,
        late,
        percentage: Math.round((present / total) * 1000) / 10,
        rows: records.map((r) => ({
          date: r.date.toISOString(),
          status: r.status as "PRESENT" | "ABSENT" | "LATE",
        })),
      };
    });
  }

  async update(schoolId: string, id: string, dto: UpdateStudentInput) {
    await this.findOne(schoolId, id);
    const updated = await this.prisma.forTenant(schoolId, async (tx) => {
      if (dto.classId) {
        const cls = await tx.class.findFirst({
          where: { id: dto.classId },
          select: { id: true },
        });
        if (!cls) throw new BadRequestException("Invalid class");
      }
      if (dto.sectionId) {
        const sec = await tx.section.findFirst({
          where: { id: dto.sectionId },
          select: { id: true },
        });
        if (!sec) throw new BadRequestException("Invalid section");
      }
      return tx.student.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          dob: dto.dob,
          phone: dto.phone,
          notes: dto.notes,
          classId: dto.classId,
          sectionId: dto.sectionId,
          monthlyFee: dto.monthlyFee,
          status: dto.status,
        },
        include: studentInclude,
      });
    });
    return this.attachPhotoMeta(updated);
  }

  /** Delete a student; delete the parent too iff it has no other children. */
  async remove(schoolId: string, id: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id },
        select: { id: true, parentId: true, photoKey: true },
      });
      if (!student) throw new NotFoundException("Student not found");

      await this.removePhotoObject(student.photoKey);
      await tx.student.delete({ where: { id } });

      const remaining = await tx.student.count({
        where: { parentId: student.parentId },
      });
      if (remaining === 0) {
        const parent = await tx.parent.findFirst({
          where: { id: student.parentId },
          select: { userId: true },
        });
        await tx.parent.delete({ where: { id: student.parentId } });
        if (parent) {
          await tx.user.delete({ where: { id: parent.userId } });
        }
      }
      return { success: true, parentDeleted: remaining === 0 };
    });
  }
}
