import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { DocumentsService } from "../documents/documents.service";
import { StorageService } from "../storage/storage.service";
import { StudentsService } from "../students/students.service";

@Injectable()
export class ImportsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly docs: DocumentsService,
    private readonly storage: StorageService,
    private readonly students: StudentsService,
  ) {}

  async importStudents(
    schoolId: string,
    file: Buffer,
    classId: string,
    sectionId?: string | null,
  ) {
    const rows = await this.docs.parseExcelRows(file);
    const job = await this.prisma.forTenant(schoolId, (tx) =>
      tx.importJob.create({
        data: { schoolId, type: "STUDENTS", status: "RUNNING" },
      }),
    );

    let imported = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const row of rows) {
      try {
        const fullName = row.fullName || row.Name || row.name;
        const parentPhone = row.phone || row.Phone || row.parentPhone;
        const parentName =
          row.parentName || row.ParentName || row.parent || "Parent";
        if (!fullName || !parentPhone) {
          failed++;
          errors.push(`Missing name/phone: ${JSON.stringify(row)}`);
          continue;
        }
        await this.students.register(schoolId, {
          fullName,
          gender: (row.gender || row.Gender || "MALE") as "MALE" | "FEMALE",
          parentName,
          parentPhone,
          classId,
          sectionId: sectionId ?? undefined,
          monthlyFee: Number(row.monthlyFee || row.fee || 0) || 0,
          phone: row.studentPhone || row.StudentPhone || undefined,
          notes: row.notes || undefined,
        });
        imported++;
      } catch (e) {
        failed++;
        errors.push(e instanceof Error ? e.message : "Row failed");
      }
    }

    return this.prisma.forTenant(schoolId, (tx) =>
      tx.importJob.update({
        where: { id: job.id },
        data: {
          status: failed && !imported ? "FAILED" : "COMPLETED",
          summary: { imported, failed, errors: errors.slice(0, 20) },
          completedAt: new Date(),
        },
      }),
    );
  }

  listJobs(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.importJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    );
  }

  async storeUpload(schoolId: string, filename: string, body: Buffer) {
    const bucket = process.env.MINIO_BUCKET ?? "ekulmis";
    const key = `${schoolId}/imports/${Date.now()}_${filename}`;
    try {
      await this.storage.ensureBucket(bucket);
      await this.storage.putObject(bucket, key, body, "application/octet-stream");
      return { key };
    } catch (e) {
      throw new BadRequestException(
        e instanceof Error ? e.message : "Upload failed",
      );
    }
  }
}
