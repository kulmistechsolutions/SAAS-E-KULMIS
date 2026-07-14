import { Injectable } from "@nestjs/common";
import { SearchService, type SearchHit, type SearchOptions } from "./search.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class PostgresSearchService extends SearchService {
  constructor(private readonly prisma: PrismaService) {
    super();
  }

  async search(
    schoolId: string,
    query: string,
    options?: SearchOptions,
  ): Promise<SearchHit[]> {
    const q = query.trim();
    if (!q) return [];
    const limit = options?.limit ?? 20;
    const types = options?.types ?? ["student", "teacher", "parent"];

    return this.prisma.forTenant(schoolId, async (tx) => {
      const hits: SearchHit[] = [];
      const pattern = `%${q}%`;

      if (types.includes("student")) {
        const students = await tx.student.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          select: { id: true, code: true, fullName: true },
        });
        hits.push(
          ...students.map((s) => ({
            id: s.id,
            type: "student",
            label: `${s.fullName} (${s.code})`,
          })),
        );
      }

      if (types.includes("teacher")) {
        const teachers = await tx.teacher.findMany({
          where: {
            OR: [
              { fullName: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          select: { id: true, code: true, fullName: true },
        });
        hits.push(
          ...teachers.map((t) => ({
            id: t.id,
            type: "teacher",
            label: `${t.fullName} (${t.code})`,
          })),
        );
      }

      if (types.includes("parent")) {
        const parents = await tx.parent.findMany({
          where: {
            OR: [
              { name: { contains: q, mode: "insensitive" } },
              { code: { contains: q, mode: "insensitive" } },
              { phone: { contains: q, mode: "insensitive" } },
            ],
          },
          take: limit,
          select: { id: true, code: true, name: true },
        });
        hits.push(
          ...parents.map((p) => ({
            id: p.id,
            type: "parent",
            label: `${p.name} (${p.code})`,
          })),
        );
      }

      return hits.slice(0, limit);
    });
  }
}
