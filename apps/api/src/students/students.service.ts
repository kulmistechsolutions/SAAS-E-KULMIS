import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { Prisma, PrismaClient } from "@prisma/client";
import type {
  AddStudentClassInput,
  RegisterStudentInput,
  UpdateStudentInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { FeesService } from "../finance/fees.service";
import { SubscriptionsService } from "../subscriptions/subscriptions.service";
import { hashPassword } from "../auth/password.util";
import { PasswordPolicyService } from "../settings/password-policy.service";
import { NotificationsService } from "../notifications/notifications.service";
import { normalizeName } from "../common/person-identity.util";
import {
  assertStudentPhotoMime,
  photoContentTypeFromKey,
  photoExtension,
  STUDENT_PHOTO_MAX_BYTES,
  studentPhotoKey,
} from "./student-photo.util";
import { studentInClassWhere } from "./student-class.util";

import { nextParentCode, nextStudentCode } from "./code-allocator";
import { decideParentChange } from "./parent-link";

const DEFAULT_PARENT_PASSWORD = "12345";

/** True for "unique constraint failed" on a student/parent code. */
function isCodeCollision(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === "P2002";
}

/** Run `fn`, retrying while a concurrent registration steals the code. */
async function retryOnCodeCollision<T>(fn: () => Promise<T>): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await fn();
    } catch (err) {
      if (!isCodeCollision(err)) throw err;
      lastError = err;
    }
  }
  throw lastError;
}

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
  village: { select: { id: true, name: true } },
  district: { select: { id: true, name: true } },
  extraClasses: {
    select: {
      id: true,
      classId: true,
      sectionId: true,
      class: {
        select: {
          id: true,
          name: true,
          academicYearId: true,
          academicYear: { select: { name: true } },
        },
      },
      section: { select: { id: true, name: true } },
    },
  },
} satisfies Prisma.StudentInclude;

// Re-exported for callers that already import from this service.
export { studentSitsIn } from "./student-class.util";


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
    private readonly subscriptions: SubscriptionsService,
    private readonly passwordPolicy: PasswordPolicyService,
    private readonly notifications: NotificationsService,
  ) {
    this.bucket =
      this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
      this.config.get<string>("MINIO_BUCKET") ??
      "ekulmis";
  }

  private async attachPhotoMeta(
    student: StudentRow,
  ): Promise<StudentWithPhoto> {
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

  private async removePhotoObject(
    key: string | null | undefined,
  ): Promise<void> {
    if (!key) return;
    try {
      await this.storage.removeObject(this.bucket, key);
      this.logger.log(
        `Removed storage object bucket=${this.bucket} key=${key}`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        `Failed to remove storage object key=${key}: ${message}`,
      );
    }
  }

  /**
   * Register a student. Auto-creates the parent (reused by phone), auto-assigns
   * sequential Student/Parent IDs from the school prefixes, prevents duplicates,
   * and validates the class/section — all in one tenant transaction.
   */
  async register(schoolId: string, dto: RegisterStudentInput) {
    await this.subscriptions.assertCanAddStudent(schoolId);
    const registerOnce = () =>
      this.prisma.forTenant(schoolId, async (tx) => {
        const school = await tx.school.findUnique({
          where: { id: schoolId },
          select: {
            studentPrefix: true,
            parentPrefix: true,
            studentIdLength: true,
            villageRequired: true,
            districtRequired: true,
          },
        });
        if (!school) throw new NotFoundException("School not found");
        if (school.villageRequired && !dto.villageId) {
          throw new BadRequestException("Village is required.");
        }
        if (school.districtRequired && !dto.districtId) {
          throw new BadRequestException("District is required.");
        }

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
          const { code: parentCode } = await nextParentCode(
            tx,
            schoolId,
            school.parentPrefix,
            school.studentIdLength,
          );
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

        // One child, one record. The parent already identifies the family, so
        // the same name under the same parent is the same child — whatever
        // class they're being put in. The old check also required a matching
        // class and section, which let the very same student be registered
        // again into a different class and collect a second ID, a second fee
        // ledger and a second set of marks. Promotion moves a student between
        // classes by updating this row, so nothing legitimate needs a second
        // one. Names are compared ignoring case and stray spacing.
        const siblings = await tx.student.findMany({
          where: { parentId: parent.id },
          select: { id: true, code: true, fullName: true },
        });
        const wanted = normalizeName(dto.fullName);
        const dup = siblings.find((s) => normalizeName(s.fullName) === wanted);
        if (dup) {
          throw new ConflictException(
            `${dup.fullName} is already registered under this parent (${dup.code}). ` +
              "Open that student to edit them, or use a different name.",
          );
        }

        const { code } = await nextStudentCode(
          tx,
          schoolId,
          school.studentPrefix,
          school.studentIdLength,
        );
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
            placeOfBirth: dto.placeOfBirth ?? null,
            motherName: dto.motherName ?? null,
            portalPasswordHash,
            parentId: parent.id,
            classId: dto.classId,
            sectionId,
            villageId: dto.villageId ?? null,
            districtId: dto.districtId ?? null,
            monthlyFee: dto.monthlyFee ?? 0,
            feeStartMode: dto.feeStartMode ?? null,
            feeAgreementAmount: dto.agreementAmount ?? null,
            feeWaived: dto.feeWaived ?? false,
          },
          include: studentInclude,
        });

        return {
          student,
          parentCreated: initialParentPassword !== undefined,
          initialParentPassword,
        };
      });

    // Codes are the lowest free number, so two registrations landing at the
    // same instant can pick the same one. The unique index catches it; retry
    // and the loser simply takes the next free number.
    const result = await retryOnCodeCollision(registerOnce);

    const student = await this.attachPhotoMeta(result.student);
    try {
      await this.fees.initializeStudentFees(schoolId, student.id, {
        feeStartMode: dto.feeStartMode,
        agreementAmount: dto.agreementAmount,
        chargeRegistrationFee: dto.chargeRegistrationFee,
      });
    } catch (err) {
      this.logger.warn(
        `Fee initialization skipped for ${student.code}: ${err instanceof Error ? err.message : err}`,
      );
    }

    await this.notifications.notifyEvent(schoolId, "newStudent", {
      title: "New student registered",
      body: `${student.fullName} (${student.code}) has been registered.`,
      type: "NEW_STUDENT",
    });
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
          ...studentInClassWhere(filters.classId, filters.sectionId),
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

  /**
   * Put an existing student into one more class. This is the supported way to
   * have a child sit in two classes — registering them a second time is still
   * refused, so their ID, fees and history stay on the one record.
   */
  async addClass(
    schoolId: string,
    studentId: string,
    dto: AddStudentClassInput,
  ) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const student = await tx.student.findFirst({
        where: { id: studentId },
        select: {
          id: true,
          classId: true,
          fullName: true,
          class: { select: { academicYearId: true } },
        },
      });
      if (!student) throw new NotFoundException("Student not found");

      if (student.classId === dto.classId) {
        throw new ConflictException(
          "That is already this student's main class.",
        );
      }

      const cls = await tx.class.findFirst({
        where: { id: dto.classId },
        select: { id: true, name: true, hasSections: true, academicYearId: true },
      });
      if (!cls) throw new NotFoundException("Class not found");
      // An extra class must sit in the same academic year as the student's
      // home class — mixing years here would silently duplicate what
      // Transfer Academic Year is for, and orphan the enrollment once the
      // school moves on to the next year.
      if (cls.academicYearId !== student.class.academicYearId) {
        throw new BadRequestException(
          "Choose a class from the student's own academic year.",
        );
      }

      if (dto.sectionId) {
        const section = await tx.section.findFirst({
          where: { id: dto.sectionId, classId: dto.classId },
          select: { id: true },
        });
        if (!section) {
          throw new BadRequestException(
            "That section does not belong to the chosen class.",
          );
        }
      }

      const existing = await tx.studentClassEnrollment.findFirst({
        where: { studentId, classId: dto.classId },
        select: { id: true },
      });
      if (existing) {
        throw new ConflictException(
          `${student.fullName} is already in ${cls.name}.`,
        );
      }

      return tx.studentClassEnrollment.create({
        data: {
          schoolId,
          studentId,
          classId: dto.classId,
          sectionId: dto.sectionId ?? null,
        },
        select: {
          id: true,
          classId: true,
          sectionId: true,
          class: { select: { id: true, name: true } },
          section: { select: { id: true, name: true } },
        },
      });
    });
  }

  /** Take a student out of an additional class. The home class is untouched. */
  async removeClass(schoolId: string, studentId: string, enrollmentId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const row = await tx.studentClassEnrollment.findFirst({
        where: { id: enrollmentId, studentId },
        select: { id: true },
      });
      if (!row) throw new NotFoundException("Extra class not found");
      await tx.studentClassEnrollment.delete({ where: { id: enrollmentId } });
      return { success: true };
    });
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

  /**
   * A student's attendance, optionally for one academic year.
   *
   * Every record carries the year it was taken in, so asking for a past year
   * returns that year's register rather than the last N days of whatever the
   * student is doing now — which is what a school looking back at a finished
   * year actually needs to see.
   */
  async attendanceHistory(
    schoolId: string,
    studentId: string,
    limit = 60,
    academicYearId?: string,
  ) {
    await this.findOne(schoolId, studentId);
    return this.prisma.forTenant(schoolId, async (tx) => {
      const records = await tx.studentAttendance.findMany({
        where: { studentId, ...(academicYearId ? { academicYearId } : {}) },
        orderBy: { date: "desc" },
        take: limit,
        include: { shift: { select: { name: true } } },
      });
      let present = 0;
      let absent = 0;
      let late = 0;
      let excused = 0;
      for (const r of records) {
        if (r.status === "PRESENT") present++;
        else if (r.status === "ABSENT") absent++;
        else if (r.status === "LATE") late++;
        else if (r.status === "EXCUSED") excused++;
      }
      const totalMarked = present + absent + late;
      return {
        present,
        absent,
        late,
        excused,
        totalMarked,
        percentage: Math.round((present / (totalMarked || 1)) * 1000) / 10,
        rows: records.map((r) => ({
          date: r.date.toISOString(),
          status: r.status as "PRESENT" | "ABSENT" | "LATE" | "EXCUSED",
          shiftName: r.shift?.name ?? null,
        })),
      };
    });
  }

  async update(schoolId: string, id: string, dto: UpdateStudentInput) {
    const current = await this.findOne(schoolId, id);
    const result = await this.prisma.forTenant(schoolId, async (tx) => {
      const move = await this.resolveParentChange(tx, schoolId, current, dto);

      // Renaming must not create the duplicate registration refuses: a second
      // child with the same name under the same parent. The check follows the
      // student to whichever parent they are landing under, not the one they
      // are leaving.
      const parentId = move?.parentId ?? current.parentId;
      if (dto.fullName !== undefined || move) {
        const siblings = await tx.student.findMany({
          where: { parentId, id: { not: id } },
          select: { code: true, fullName: true },
        });
        const wanted = normalizeName(dto.fullName ?? current.fullName);
        const clash = siblings.find(
          (s) => normalizeName(s.fullName) === wanted,
        );
        if (clash) {
          throw new ConflictException(
            `${clash.fullName} (${clash.code}) is already registered under this parent.`,
          );
        }
      }
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
      const updated = await tx.student.update({
        where: { id },
        data: {
          fullName: dto.fullName,
          gender: dto.gender,
          dob: dto.dob,
          phone: dto.phone,
          notes: dto.notes,
          placeOfBirth: dto.placeOfBirth,
          motherName: dto.motherName,
          classId: dto.classId,
          sectionId: dto.sectionId,
          villageId: dto.villageId,
          districtId: dto.districtId,
          monthlyFee: dto.monthlyFee,
          feeWaived: dto.feeWaived,
          status: dto.status,
          ...(move ? { parentId: move.parentId } : {}),
        },
        include: studentInclude,
      });

      // Turning a student free must settle what they already owed, not just
      // stop billing them going forward — a charge created before the waive
      // sat UNPAID/PARTIAL forever, so a "Free" student's own record kept
      // showing money owed with nowhere left to pay it. Only the remaining
      // balance is forgiven; money already collected and receipted is untouched.
      const wasFree = current.feeWaived || current.monthlyFee === 0;
      const isFreeNow = updated.feeWaived || updated.monthlyFee === 0;
      if (!wasFree && isFreeNow) {
        const unsettled = await tx.feeCharge.findMany({
          where: { studentId: id, kind: "MONTHLY", status: { not: "PAID" } },
          select: { id: true, paidAmount: true },
        });
        for (const c of unsettled) {
          await tx.feeCharge.update({
            where: { id: c.id },
            data: { amount: c.paidAmount, status: "PAID" },
          });
        }
      }

      // Changing the monthly fee must reprice what is still owed, not only
      // what gets billed next. A student set up at $10 whose fee is raised to
      // $15 kept a $10 charge sitting there, so the school collected the old
      // rate for the month it had just changed and the difference was simply
      // lost. Only months not yet settled move: a paid month is history, and
      // a part-payment keeps what was already collected against it.
      const feeChanged =
        dto.monthlyFee !== undefined &&
        dto.monthlyFee !== current.monthlyFee &&
        !isFreeNow;
      if (feeChanged) {
        const newFee = updated.monthlyFee;
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth() + 1;
        const open = await tx.feeCharge.findMany({
          where: {
            studentId: id,
            kind: "MONTHLY",
            status: { in: ["UNPAID", "PARTIAL"] },
            // Only rows still carrying the old rate — a month priced by hand
            // (a one-off discount) was set deliberately and is left alone.
            amount: current.monthlyFee,
            // And only this month onward. A month already gone was billed at
            // the rate in force then; repricing it now would invent a debt for
            // a month the family was correctly charged less for.
            OR: [{ year: { gt: y } }, { year: y, month: { gte: m } }],
          },
          select: { id: true, paidAmount: true },
        });
        for (const c of open) {
          // Raising the fee past what a family already paid reopens the month;
          // lowering it below that settles it rather than owing them money back.
          await tx.feeCharge.update({
            where: { id: c.id },
            data: {
              amount: newFee,
              status:
                c.paidAmount >= newFee
                  ? "PAID"
                  : c.paidAmount > 0
                    ? "PARTIAL"
                    : "UNPAID",
            },
          });
        }
      }

      // Moving a student into a class whose month is already set up must bill
      // them for it. Month setup charges whoever is in the class at the moment
      // it runs; a student who arrives afterwards was silently never charged,
      // and the desk found the month simply missing when the family came to
      // pay. HUDEYFA's Aisha was moved in four days after September was set
      // up and ended the month with no tuition charge at all.
      const movedClass =
        dto.classId !== undefined && dto.classId !== current.classId;
      if (movedClass && !isFreeNow) {
        const now = new Date();
        const y = now.getUTCFullYear();
        const m = now.getUTCMonth() + 1;
        const notYetBillable =
          updated.feeBillingStartYear && updated.feeBillingStartMonth
            ? y * 100 + m <
              updated.feeBillingStartYear * 100 + updated.feeBillingStartMonth
            : false;
        const activated = await tx.monthlyFeeActivation.findFirst({
          where: { year: y, month: m, classId: updated.classId },
          select: { id: true },
        });
        if (activated && !notYetBillable) {
          const existing = await tx.feeCharge.findFirst({
            where: { studentId: id, year: y, month: m, kind: "MONTHLY" },
            select: { id: true },
          });
          if (!existing) {
            const amount = updated.monthlyFee;
            await tx.feeCharge.create({
              data: {
                schoolId,
                studentId: id,
                year: y,
                month: m,
                amount,
                status: amount === 0 ? "PAID" : "UNPAID",
              },
            });
          }
        }
      }

      // Only once the child has actually left is the old family checked. A
      // parent record with nobody under it is the same orphan a deletion
      // leaves behind, and is cleared the same way.
      let formerParentRemoved = false;
      if (move && move.previousParentId !== move.parentId) {
        formerParentRemoved = await this.dropParentIfChildless(
          tx,
          move.previousParentId,
        );
      }

      return {
        student: updated,
        parentCreated: move?.created ?? false,
        parentCode: move?.created ? move.code : undefined,
        initialParentPassword: move?.initialPassword,
        formerParentRemoved,
        /** Set only when the child changed families, so the UI can say so. */
        movedToParentName: move ? updated.parent.name : undefined,
      };
    });
    return {
      ...result,
      student: await this.attachPhotoMeta(result.student),
    };
  }

  /**
   * Work out which parent a student edit is pointing at.
   *
   * A school correcting a child registered under the wrong family types the
   * right parent's details. The obvious reading of that — rename the parent
   * the student is attached to — is wrong twice over: it rewrites a real
   * family's name for every one of their other children, and it collides with
   * the unique phone of the parent actually being named, so the save fails.
   * Editing the parent details on a student therefore MOVES the student:
   * to the parent already holding that phone, or to a new one.
   *
   * Returns null when nothing about the parent changed.
   */
  private async resolveParentChange(
    tx: PrismaClient,
    schoolId: string,
    current: StudentRow,
    dto: UpdateStudentInput,
  ): Promise<{
    parentId: string;
    previousParentId: string;
    created: boolean;
    code?: string;
    initialPassword?: string;
  } | null> {
    if (dto.parentName === undefined && dto.parentPhone === undefined) {
      return null;
    }
    const name = (dto.parentName ?? current.parent.name).trim();
    const phone = (dto.parentPhone ?? current.parent.phone).trim();
    const previousParentId = current.parentId;

    const holder = await tx.parent.findFirst({
      where: { phone },
      select: { id: true },
    });
    const decision = decideParentChange({
      holderId: holder?.id ?? null,
      currentParentId: previousParentId,
      siblingCount: await tx.student.count({
        where: { parentId: previousParentId, id: { not: current.id } },
      }),
      nameChanged: name !== current.parent.name,
      phoneChanged: phone !== current.parent.phone,
    });

    switch (decision.kind) {
      case "none":
        return null;
      case "rename":
        await tx.parent.update({
          where: { id: previousParentId },
          data: { name, phone },
        });
        return null;
      case "attach":
        return {
          parentId: decision.parentId,
          previousParentId,
          created: false,
        };
      case "create": {
        const made = await this.createParent(tx, schoolId, name, phone);
        return { ...made, previousParentId, created: true };
      }
    }
  }

  /** A parent record with its own ID and portal login, as registration makes. */
  private async createParent(
    tx: PrismaClient,
    schoolId: string,
    name: string,
    phone: string,
  ) {
    const school = await tx.school.findUnique({
      where: { id: schoolId },
      select: { parentPrefix: true, studentIdLength: true },
    });
    if (!school) throw new NotFoundException("School not found");
    const { code } = await nextParentCode(
      tx,
      schoolId,
      school.parentPrefix,
      school.studentIdLength,
    );
    const user = await tx.user.create({
      data: {
        schoolId,
        username: code,
        role: "PARENT",
        passwordHash: await hashPassword(DEFAULT_PARENT_PASSWORD),
      },
    });
    const parent = await tx.parent.create({
      data: { schoolId, code, name, phone, userId: user.id },
    });
    return {
      parentId: parent.id,
      code,
      initialPassword: DEFAULT_PARENT_PASSWORD,
    };
  }

  /** Clear a parent left with no children, as a deletion would. */
  private async dropParentIfChildless(
    tx: PrismaClient,
    parentId: string,
  ): Promise<boolean> {
    const remaining = await tx.student.count({ where: { parentId } });
    if (remaining > 0) return false;
    const parent = await tx.parent.findFirst({
      where: { id: parentId },
      select: { userId: true },
    });
    await tx.parent.delete({ where: { id: parentId } });
    if (parent) await tx.user.delete({ where: { id: parent.userId } });
    return true;
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

  /**
   * Delete several students at once (multi-select on the students page). Like
   * single delete, IDs are retired — never reused — and a parent is removed
   * only once none of their children remain anywhere. Photos are cleared for
   * the deleted students. Runs in one transaction so a partial failure leaves
   * nothing half-deleted.
   */
  async removeMany(schoolId: string, ids: string[]) {
    const unique = [...new Set(ids)].filter(Boolean);
    if (unique.length === 0) {
      throw new BadRequestException("No students selected");
    }
    const { deletedCount, parentsDeleted, photoKeys } =
      await this.prisma.forTenant(
        schoolId,
        async (tx) => {
          const students = await tx.student.findMany({
            where: { id: { in: unique } },
            select: { id: true, parentId: true, photoKey: true },
          });
          if (students.length === 0) {
            throw new NotFoundException("No matching students");
          }
          const parentIds = [...new Set(students.map((s) => s.parentId))];
          const keys = students
            .map((s) => s.photoKey)
            .filter((k): k is string => !!k);

          const deleted = await tx.student.deleteMany({
            where: { id: { in: students.map((s) => s.id) } },
          });

          // Parents left with no children anywhere go too (User cascades Parent).
          const orphans = parentIds.length
            ? await tx.parent.findMany({
                where: { id: { in: parentIds }, students: { none: {} } },
                select: { userId: true },
              })
            : [];
          if (orphans.length) {
            await tx.user.deleteMany({
              where: { id: { in: orphans.map((o) => o.userId) } },
            });
          }

          return {
            deletedCount: deleted.count,
            parentsDeleted: orphans.length,
            photoKeys: keys,
          };
        },
        { timeout: 60_000, maxWait: 30_000 },
      );

    // Storage cleanup runs outside the transaction — a missing object must not
    // roll back the delete.
    for (const key of photoKeys) await this.removePhotoObject(key);

    return { success: true, deletedCount, parentsDeleted };
  }

  /**
   * Resets a student's portal login password. Unlike teacher/parent resets,
   * there's no linked User row or refresh token to revoke — a student portal
   * session is a single 24h access token (see StudentPortalService), so an
   * old token stays valid until it naturally expires even after this runs.
   */
  async resetPortalPassword(schoolId: string, id: string, customPassword?: string) {
    const student = await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.findFirst({ where: { id }, select: { id: true, code: true } }),
    );
    if (!student) throw new NotFoundException("Student not found");

    const chosen = customPassword?.trim();
    if (chosen) await this.passwordPolicy.assertAllowed(schoolId, chosen);
    const password = chosen || student.code;
    const portalPasswordHash = await hashPassword(password);
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.student.update({ where: { id }, data: { portalPasswordHash } }),
    );
    return { password };
  }
}
