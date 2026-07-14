import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";

@Injectable()
export class BackupService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  async createJob(schoolId: string) {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const job = await tx.backupJob.create({
        data: { schoolId, status: "RUNNING" },
      });

      const [school, students, teachers, classes, academicYears] =
        await Promise.all([
          tx.school.findUnique({ where: { id: schoolId } }),
          tx.student.findMany({ include: { parent: true } }),
          tx.teacher.findMany(),
          tx.class.findMany({ include: { sections: true } }),
          tx.academicYear.findMany(),
        ]);

      const payload = Buffer.from(
        JSON.stringify(
          {
            schoolId,
            createdAt: new Date().toISOString(),
            school,
            students,
            teachers,
            classes,
            academicYears,
          },
          null,
          2,
        ),
        "utf8",
      );
      const key = `${schoolId}/backups/${job.id}.json`;
      try {
        const bucket = process.env.MINIO_BUCKET ?? "ekulmis";
        await this.storage.ensureBucket(bucket);
        await this.storage.putObject(bucket, key, payload, "application/json");
        return tx.backupJob.update({
          where: { id: job.id },
          data: {
            status: "COMPLETED",
            storageKey: key,
            sizeBytes: payload.length,
            completedAt: new Date(),
          },
        });
      } catch (e) {
        return tx.backupJob.update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            error: e instanceof Error ? e.message : "Backup failed",
            completedAt: new Date(),
          },
        });
      }
    });
  }

  listJobs(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.backupJob.findMany({ orderBy: { createdAt: "desc" }, take: 20 }),
    );
  }
}
