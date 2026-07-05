import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class ParentsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll(schoolId: string) {
    return this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findMany({
        orderBy: { name: "asc" },
        include: { _count: { select: { students: true } } },
      }),
    );
  }

  async findOne(schoolId: string, id: string) {
    const parent = await this.prisma.forTenant(schoolId, (tx) =>
      tx.parent.findFirst({
        where: { id },
        include: {
          students: {
            select: { id: true, code: true, fullName: true, status: true },
          },
        },
      }),
    );
    if (!parent) throw new NotFoundException("Parent not found");
    return parent;
  }
}
