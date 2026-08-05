import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type {
  RequestSmsSenderIdInput,
  ReviewSmsSenderIdInput,
} from "@ekulmis/shared";
import { PrismaService } from "../prisma/prisma.service";
import { StorageService } from "../storage/storage.service";
import { SmsService } from "./sms.service";

const MAX_DOC_BYTES = 5 * 1024 * 1024;

/** Documents an operator will accept as proof the school is a real body. */
const DOC_MIME_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
]);

function docExtension(mime: string): string {
  switch (mime) {
    case "application/pdf":
      return "pdf";
    case "image/jpeg":
      return "jpg";
    case "image/png":
      return "png";
    case "image/webp":
      return "webp";
    default:
      return "bin";
  }
}

/**
 * Sender ID applications (Module 17).
 *
 * The name recipients see on an SMS is registered with the mobile operator
 * against a licensed organisation — it is not a display setting a school can
 * type for itself. So a school applies with the name it wants and its
 * registration document, and the platform owner, who deals with the operator,
 * grants it. Approval writes the granted name to `School.smsSenderName`, which
 * is the only field the sending path reads; nothing school-side can write it.
 */
@Injectable()
export class SmsSenderIdService {
  private readonly logger = new Logger(SmsSenderIdService.name);
  private readonly bucket: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: ConfigService,
    private readonly sms: SmsService,
  ) {
    this.bucket =
      this.config.get<string>("SUPABASE_STORAGE_BUCKET") ??
      this.config.get<string>("MINIO_BUCKET") ??
      "ekulmis";
  }

  /** What the school sees: the live name, and any application in flight. */
  async mySenderId(schoolId: string) {
    const school = await this.prisma.school.findUnique({
      where: { id: schoolId },
      select: { name: true, smsSenderName: true },
    });
    if (!school) throw new NotFoundException("School not found");

    const requests = await this.prisma.smsSenderIdRequest.findMany({
      where: { schoolId },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        id: true,
        requestedName: true,
        approvedName: true,
        status: true,
        licenseDocName: true,
        contactPerson: true,
        contactPhone: true,
        note: true,
        reviewNote: true,
        reviewedAt: true,
        createdAt: true,
      },
    });

    const pending = requests.find((r) => r.status === "PENDING") ?? null;
    return {
      schoolName: school.name,
      /** null until an application is approved — messages then carry this. */
      activeSenderId: school.smsSenderName,
      pending,
      history: requests,
    };
  }

  /** A school applies. One application at a time, so a queue can't build up. */
  async request(schoolId: string, dto: RequestSmsSenderIdInput) {
    const open = await this.prisma.smsSenderIdRequest.findFirst({
      where: { schoolId, status: "PENDING" },
      select: { id: true, requestedName: true },
    });
    if (open) {
      throw new ConflictException(
        `An application for "${open.requestedName}" is already awaiting review.`,
      );
    }

    let licenseDocKey: string | null = null;
    let licenseDocName: string | null = null;
    if (dto.licenseDoc) {
      const mime = dto.licenseDocMime ?? "application/pdf";
      if (!DOC_MIME_TYPES.has(mime)) {
        throw new BadRequestException(
          "Attach the licence as a PDF, JPEG, PNG or WebP.",
        );
      }
      const buffer = Buffer.from(dto.licenseDoc, "base64");
      if (buffer.length === 0) {
        throw new BadRequestException("The attached document is empty.");
      }
      if (buffer.length > MAX_DOC_BYTES) {
        throw new BadRequestException("The document must be under 5 MB.");
      }
      licenseDocKey = `${schoolId}/sms/sender-id/${Date.now()}.${docExtension(mime)}`;
      licenseDocName = dto.licenseDocName ?? `licence.${docExtension(mime)}`;
      await this.storage.putObject(this.bucket, licenseDocKey, buffer, mime);
    }

    const created = await this.prisma.smsSenderIdRequest.create({
      data: {
        schoolId,
        requestedName: dto.requestedName,
        contactPerson: dto.contactPerson ?? null,
        contactPhone: dto.contactPhone ?? null,
        note: dto.note ?? null,
        licenseDocKey,
        licenseDocName,
      },
      select: {
        id: true,
        requestedName: true,
        status: true,
        createdAt: true,
      },
    });
    this.logger.log(
      `Sender ID applied for: "${created.requestedName}" by school ${schoolId}`,
    );
    return created;
  }

  // ── Platform owner ───────────────────────────────────────────────────────

  /** Every application across every school, newest first. */
  async listRequests(status?: string) {
    const rows = await this.prisma.smsSenderIdRequest.findMany({
      where: status ? { status } : {},
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 200,
      include: {
        school: { select: { id: true, name: true, subdomain: true } },
      },
    });
    return rows.map((r) => ({
      id: r.id,
      school: r.school,
      requestedName: r.requestedName,
      approvedName: r.approvedName,
      status: r.status,
      hasDocument: !!r.licenseDocKey,
      licenseDocName: r.licenseDocName,
      contactPerson: r.contactPerson,
      contactPhone: r.contactPhone,
      note: r.note,
      reviewNote: r.reviewNote,
      reviewedByUsername: r.reviewedByUsername,
      reviewedAt: r.reviewedAt,
      createdAt: r.createdAt,
    }));
  }

  /** The uploaded licence, streamed back for the reviewer to read. */
  async requestDocument(id: string) {
    const row = await this.prisma.smsSenderIdRequest.findUnique({
      where: { id },
      select: { licenseDocKey: true, licenseDocName: true },
    });
    if (!row?.licenseDocKey) {
      throw new NotFoundException("No document was attached to this request");
    }
    const buffer = await this.storage.getObject(this.bucket, row.licenseDocKey);
    const ext = row.licenseDocKey.split(".").pop() ?? "bin";
    const contentType =
      ext === "pdf"
        ? "application/pdf"
        : ext === "png"
          ? "image/png"
          : ext === "webp"
            ? "image/webp"
            : "image/jpeg";
    return {
      buffer,
      contentType,
      filename: row.licenseDocName ?? `licence.${ext}`,
    };
  }

  /**
   * Grant the sender ID. The owner types the name actually registered with the
   * operator — which may not be what the school asked for — and that name
   * becomes the school's sending name from the next message on.
   */
  async approve(id: string, dto: ReviewSmsSenderIdInput, reviewer: string) {
    const row = await this.prisma.smsSenderIdRequest.findUnique({
      where: { id },
      select: { id: true, schoolId: true, requestedName: true, status: true },
    });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING") {
      throw new ConflictException(`This request is already ${row.status}.`);
    }
    if (!dto.testPhone) {
      throw new BadRequestException(
        "A test phone number is required to approve — one live SMS is sent " +
          "with this sender ID first, since our own approval has no bearing " +
          "on whether Hormuud has actually registered the name.",
      );
    }

    // Default to what the school asked for, so approving a straightforward
    // application is one click.
    const approvedName = (dto.approvedName ?? row.requestedName).trim();

    // Our own approval only ever updates our database — the operator still
    // has to have this exact name registered against the account that sends
    // for this school, or every message the school sends afterward silently
    // fails with Hormuud's 203 "Invalid Sender ID". Catch that here, against
    // the reviewer, instead of in a school's delivery log days later.
    const test = await this.sms.testSenderIdWithRealSend(
      row.schoolId,
      approvedName,
      dto.testPhone,
    );
    if (!test.ok) {
      throw new BadRequestException(
        `Hormuud rejected "${approvedName}": ${test.message}. Register this ` +
          "name with Hormuud for this school's sending account before approving.",
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.smsSenderIdRequest.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedName,
          reviewNote: dto.reviewNote ?? null,
          reviewedByUsername: reviewer,
          reviewedAt: new Date(),
        },
        select: { id: true, approvedName: true, status: true },
      }),
      // The one place School.smsSenderName is ever written.
      this.prisma.school.update({
        where: { id: row.schoolId },
        data: { smsSenderName: approvedName },
      }),
    ]);

    this.logger.warn(
      `Sender ID "${approvedName}" approved for school ${row.schoolId} by ${reviewer} (Hormuud-verified)`,
    );
    return updated;
  }

  /** Turn it down, with a reason the school can act on. */
  async reject(id: string, dto: ReviewSmsSenderIdInput, reviewer: string) {
    const row = await this.prisma.smsSenderIdRequest.findUnique({
      where: { id },
      select: { id: true, schoolId: true, status: true },
    });
    if (!row) throw new NotFoundException("Request not found");
    if (row.status !== "PENDING") {
      throw new ConflictException(`This request is already ${row.status}.`);
    }
    if (!dto.reviewNote?.trim()) {
      throw new BadRequestException(
        "Give a reason — the school needs to know what to correct.",
      );
    }

    const updated = await this.prisma.smsSenderIdRequest.update({
      where: { id },
      data: {
        status: "REJECTED",
        reviewNote: dto.reviewNote.trim(),
        reviewedByUsername: reviewer,
        reviewedAt: new Date(),
      },
      select: { id: true, status: true, reviewNote: true },
    });
    this.logger.log(
      `Sender ID request ${id} rejected for school ${row.schoolId} by ${reviewer}`,
    );
    return updated;
  }
}
