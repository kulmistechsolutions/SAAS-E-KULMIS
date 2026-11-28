import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { PrismaService } from "../prisma/prisma.service";

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");

export const roomSchema = z.object({
  name: z.string().trim().min(1).max(80),
  building: z.string().trim().max(80).nullable().optional(),
  rows: z.number().int().min(1).max(40),
  cols: z.number().int().min(1).max(20),
  notes: z.string().trim().max(500).nullable().optional(),
});

const entrySchema = z
  .object({
    id: z.string().min(1).max(60),
    date,
    startTime: time,
    endTime: time,
    subject: z.string().trim().min(1).max(120),
    classNames: z.array(z.string().trim().min(1).max(80)).min(1).max(60),
    roomIds: z.array(z.string().min(1).max(60)).max(60).default([]),
    note: z.string().trim().max(300).optional(),
  })
  .refine((e) => e.endTime > e.startTime, { message: "The exam must end after it starts", path: ["endTime"] });

const seatingSchema = z.object({
  classNames: z.array(z.string().max(80)).max(80),
  roomIds: z.array(z.string().max(60)).max(80),
  generatedAt: z.string().max(40),
  rooms: z
    .array(
      z.object({
        roomId: z.string().max(60),
        seats: z.array(z.array(z.string().max(60).nullable()).max(20)).max(40),
      }),
    )
    .max(80),
});

export const timetableSchema = z.object({
  name: z.string().trim().min(1).max(120),
  academicYear: z.string().trim().min(1).max(40),
  entries: z.array(entrySchema).max(600).default([]),
  seating: seatingSchema.nullable().optional(),
});

export const timetablePatchSchema = timetableSchema.partial();

/**
 * Exam rooms, exam timetables and mixed seating plans.
 *
 * Kept as their own small module: a timetable is a plan for sitting exams,
 * not part of the marks engine, and nothing in marking depends on it.
 * The seating is generated in the browser (it needs only the roster the page
 * already has) and stored here whole, so every desk sees the same plan.
 */
@Injectable()
export class ExamScheduleService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Rooms ──
  listRooms(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examRoom.findMany({ orderBy: [{ building: "asc" }, { name: "asc" }] }),
    );
  }

  async createRoom(schoolId: string, dto: z.infer<typeof roomSchema>) {
    try {
      return await this.prisma.forTenant(schoolId, (tx) =>
        tx.examRoom.create({
          data: { schoolId, name: dto.name, building: dto.building ?? null, rows: dto.rows, cols: dto.cols, notes: dto.notes ?? null },
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException(`A room called "${dto.name}" already exists.`);
      }
      throw e;
    }
  }

  async updateRoom(schoolId: string, id: string, dto: z.infer<typeof roomSchema>) {
    const found = await this.prisma.forTenant(schoolId, (tx) => tx.examRoom.findFirst({ where: { id }, select: { id: true } }));
    if (!found) throw new NotFoundException("Room not found");
    try {
      return await this.prisma.forTenant(schoolId, (tx) =>
        tx.examRoom.update({
          where: { id },
          data: { name: dto.name, building: dto.building ?? null, rows: dto.rows, cols: dto.cols, notes: dto.notes ?? null },
        }),
      );
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new ConflictException(`A room called "${dto.name}" already exists.`);
      }
      throw e;
    }
  }

  async deleteRoom(schoolId: string, id: string) {
    const found = await this.prisma.forTenant(schoolId, (tx) => tx.examRoom.findFirst({ where: { id }, select: { id: true } }));
    if (!found) throw new NotFoundException("Room not found");
    await this.prisma.forTenant(schoolId, (tx) => tx.examRoom.delete({ where: { id } }));
    return { success: true };
  }

  // ── Timetables ──
  listTimetables(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examTimetable.findMany({ orderBy: { createdAt: "desc" } }),
    );
  }

  createTimetable(schoolId: string, dto: z.infer<typeof timetableSchema>) {
    this.assertNoClash(dto.entries);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examTimetable.create({
        data: {
          schoolId,
          name: dto.name,
          academicYear: dto.academicYear,
          entries: dto.entries as unknown as Prisma.InputJsonValue,
          seating: dto.seating ? (dto.seating as unknown as Prisma.InputJsonValue) : Prisma.JsonNull,
        },
      }),
    );
  }

  async updateTimetable(schoolId: string, id: string, dto: z.infer<typeof timetablePatchSchema>) {
    const found = await this.prisma.forTenant(schoolId, (tx) => tx.examTimetable.findFirst({ where: { id }, select: { id: true } }));
    if (!found) throw new NotFoundException("Timetable not found");
    if (dto.entries) this.assertNoClash(dto.entries);
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.examTimetable.update({
        where: { id },
        data: {
          ...(dto.name !== undefined ? { name: dto.name } : {}),
          ...(dto.academicYear !== undefined ? { academicYear: dto.academicYear } : {}),
          ...(dto.entries !== undefined ? { entries: dto.entries as unknown as Prisma.InputJsonValue } : {}),
          ...(dto.seating !== undefined
            ? { seating: dto.seating ? (dto.seating as unknown as Prisma.InputJsonValue) : Prisma.JsonNull }
            : {}),
        },
      }),
    );
  }

  async deleteTimetable(schoolId: string, id: string) {
    const found = await this.prisma.forTenant(schoolId, (tx) => tx.examTimetable.findFirst({ where: { id }, select: { id: true } }));
    if (!found) throw new NotFoundException("Timetable not found");
    await this.prisma.forTenant(schoolId, (tx) => tx.examTimetable.delete({ where: { id } }));
    return { success: true };
  }

  /**
   * A class cannot sit two papers at once. Two entries on the same day whose
   * times overlap and share a class are refused, naming both papers.
   */
  private assertNoClash(entries: z.infer<typeof entrySchema>[]) {
    for (let i = 0; i < entries.length; i++) {
      for (let j = i + 1; j < entries.length; j++) {
        const a = entries[i]!;
        const b = entries[j]!;
        if (a.date !== b.date) continue;
        if (!(a.startTime < b.endTime && b.startTime < a.endTime)) continue;
        const shared = a.classNames.find((c) => b.classNames.includes(c));
        if (shared) {
          throw new BadRequestException(
            `${shared} would sit ${a.subject} and ${b.subject} at the same time on ${a.date}.`,
          );
        }
      }
    }
  }
}
