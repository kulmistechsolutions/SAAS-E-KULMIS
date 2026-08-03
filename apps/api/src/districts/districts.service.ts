import { Injectable, NotFoundException } from "@nestjs/common";
import type { CreateDistrictInput, UpdateDistrictInput } from "@ekulmis/shared";
import { normalizeAcademicName } from "@ekulmis/shared";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import { onUniqueViolation } from "../academics/prisma-errors";

/**
 * A school's own district list, offered on the DETAILED registration form.
 * Mirrors VillagesService exactly.
 */
@Injectable()
export class DistrictsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string, opts?: { includeInactive?: boolean }) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.district.findMany({
        where: opts?.includeInactive ? {} : { status: "ACTIVE" },
        orderBy: [{ orderIndex: "asc" }, { name: "asc" }],
      }),
    );
  }

  async create(schoolId: string, dto: CreateDistrictInput) {
    const name = normalizeAcademicName(dto.name);
    return this.prisma
      .forTenant(schoolId, async (tx) =>
        tx.district.create({
          data: {
            schoolId,
            name,
            orderIndex:
              dto.orderIndex ??
              (await this.nextOrderIndex(tx, schoolId)),
          },
        }),
      )
      .catch(onUniqueViolation("A district with this name already exists"));
  }

  async update(schoolId: string, id: string, dto: UpdateDistrictInput) {
    await this.findOne(schoolId, id);
    return this.prisma
      .forTenant(schoolId, (tx) =>
        tx.district.update({
          where: { id },
          data: {
            ...(dto.name !== undefined && { name: normalizeAcademicName(dto.name) }),
            ...(dto.orderIndex !== undefined && { orderIndex: dto.orderIndex }),
            ...(dto.status !== undefined && { status: dto.status }),
          },
        }),
      )
      .catch(onUniqueViolation("A district with this name already exists"));
  }

  async remove(schoolId: string, id: string) {
    await this.findOne(schoolId, id);
    // Detaches rather than blocks: any student already using this district
    // falls back to null (SetNull on the FK) instead of the delete failing.
    await this.prisma.forTenant(schoolId, (tx) =>
      tx.district.delete({ where: { id } }),
    );
    return { success: true };
  }

  private async findOne(schoolId: string, id: string) {
    const district = await this.prisma.forTenant(schoolId, (tx) =>
      tx.district.findFirst({ where: { id } }),
    );
    if (!district) throw new NotFoundException("District not found");
    return district;
  }

  private async nextOrderIndex(
    tx: Prisma.TransactionClient,
    schoolId: string,
  ): Promise<number> {
    const last = await tx.district.findFirst({
      where: { schoolId },
      orderBy: { orderIndex: "desc" },
      select: { orderIndex: true },
    });
    return last ? last.orderIndex + 1 : 0;
  }
}
