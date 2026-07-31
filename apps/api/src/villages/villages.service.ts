import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateVillageInput, UpdateVillageInput } from "@ekulmis/shared";
import { normalizeAcademicName } from "@ekulmis/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "../academics/prisma-errors";

/**
 * A school's own neighborhood list, offered as an optional field on student
 * registration. Unlike Class/Level, this is not scoped to an academic year —
 * a neighborhood doesn't change when the school rolls into a new year.
 */
@Injectable()
export class VillagesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string, opts?: { includeInactive?: boolean }) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.village.findMany({
        where: opts?.includeInactive ? {} : { status: "ACTIVE" },
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      }),
    );
  }

  async create(schoolId: string, dto: CreateVillageInput) {
    const name = normalizeAcademicName(dto.name);
    return this.prisma
      .forTenant(schoolId, async (tx) =>
        tx.village.create({
          data: {
            schoolId,
            name,
            orderIndex:
              dto.orderIndex ??
              (await this.nextOrderIndex(tx, schoolId)),
          },
        }),
      )
      .catch(onUniqueViolation("A village with this name already exists"));
  }

  async update(schoolId: string, id: string, dto: UpdateVillageInput) {
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.village.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: normalizeAcademicName(dto.name) }),
            ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
            ...(dto.status !== undefined && { status: dto.status }),
          },
        }),
      )
      .catch(onUniqueViolation("A village with this name already exists"));
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    // Detaches rather than blocks: any student already using this village
    // falls back to null (SetNull on the FK) instead of the delete failing.
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.village.delete({ where: { id } }),
    );
    return { success: true };
  }

  private async findOne(schoolId: string, id: string) {
    const village = await this.prisma.forTenant(schoolId, (tx) =>
      tx.village.findFirst({ where: { id } }),
    );
    if (!village) throw new NotFoundException("Village not found");
    return village;
  }

  private async nextOrderIndex(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ): Promise<number> {
    const last = await tx.village.findFirst({
      where: { schoolId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }
}
