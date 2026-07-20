import { Injectable } from "@nestjs/common";
import type { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";
import type { ReportData } from "./fee-reports.service";

export interface PromotionReportFilters {
  className?: string;
  section?: string;
  search?: string;
}

/**
 * Promotion reports, computed from the database.
 *
 * Same fix as fees/students/teachers/exams: these used to read the browser's
 * promotions store, which only held whatever the promotions pages had run in
 * that tab. A report opened directly showed nothing until someone had visited
 * the promotions screen first.
 *
 * PromotionRecord stores fromClassId/toClassId/fromSectionId/toSectionId as
 * plain scalars with no Prisma relation to Class/Section, so class and section
 * names are resolved with a separate batched lookup rather than a `select`.
 */
@Injectable()
export class PromotionReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async build(
    schoolId: string,
    slug: string,
    filters: PromotionReportFilters,
  ): Promise<ReportData> {
    return this.prisma.forTenant(schoolId, async (tx) => {
      const classFilter = filters.className
        ? await tx.class.findFirst({
            where: { name: filters.className },
            select: { id: true },
          })
        : null;
      // A named-but-unmatched class must return zero rows, not "no filter".
      if (filters.className && !classFilter) {
        return { columns: [], rows: [], summary: [{ label: "Records", value: "0" }] };
      }
      const sectionFilter = filters.section
        ? await tx.section.findFirst({
            where: { name: filters.section, ...(classFilter ? { classId: classFilter.id } : {}) },
            select: { id: true },
          })
        : null;

      const where: Prisma.PromotionRecordWhereInput = {
        ...(slug === "individual" ? { type: "INDIVIDUAL" } : {}),
        ...(slug === "class" ? { type: "CLASS" } : {}),
        ...(slug === "school-wide" ? { type: "SCHOOL_WIDE" } : {}),
        ...(slug === "graduated" ? { graduated: true } : {}),
        ...(classFilter ? { fromClassId: classFilter.id } : {}),
        ...(sectionFilter ? { fromSectionId: sectionFilter.id } : {}),
      };

      const records = await tx.promotionRecord.findMany({
        where,
        orderBy: { promotedAt: "desc" },
        select: {
          type: true,
          graduated: true,
          promotedAt: true,
          fromClassId: true,
          fromSectionId: true,
          toClassId: true,
          toSectionId: true,
          student: { select: { code: true, fullName: true } },
        },
      });

      const classIds = new Set<string>();
      const sectionIds = new Set<string>();
      for (const r of records) {
        if (r.fromClassId) classIds.add(r.fromClassId);
        if (r.toClassId) classIds.add(r.toClassId);
        if (r.fromSectionId) sectionIds.add(r.fromSectionId);
        if (r.toSectionId) sectionIds.add(r.toSectionId);
      }
      const [classes, sections] = await Promise.all([
        classIds.size
          ? tx.class.findMany({
              where: { id: { in: [...classIds] } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
        sectionIds.size
          ? tx.section.findMany({
              where: { id: { in: [...sectionIds] } },
              select: { id: true, name: true },
            })
          : Promise.resolve([]),
      ]);
      const classNameOf = new Map(classes.map((c) => [c.id, c.name]));
      const sectionNameOf = new Map(sections.map((s) => [s.id, s.name]));

      const label = (classId: string | null, sectionId: string | null) => {
        if (!classId) return "";
        const cls = classNameOf.get(classId) ?? "";
        const sec = sectionId ? sectionNameOf.get(sectionId) : undefined;
        return sec ? `${cls} ${sec}` : cls;
      };

      if (slug === "graduated") {
        return {
          columns: [
            { key: "code", label: "Student ID", mono: true },
            { key: "name", label: "Student" },
            { key: "className", label: "Graduated From" },
            { key: "date", label: "Date" },
          ],
          rows: records.map((r) => ({
            code: r.student.code,
            name: r.student.fullName,
            className: label(r.fromClassId, r.fromSectionId),
            date: r.promotedAt.toISOString().slice(0, 10),
          })),
          summary: [{ label: "Graduated", value: String(records.length) }],
        };
      }

      return {
        columns: [
          { key: "code", label: "Student ID", mono: true },
          { key: "name", label: "Student" },
          { key: "type", label: "Type" },
          { key: "from", label: "From" },
          { key: "to", label: "To" },
          { key: "date", label: "Date" },
        ],
        rows: records.map((r) => ({
          code: r.student.code,
          name: r.student.fullName,
          type: r.type,
          from: label(r.fromClassId, r.fromSectionId),
          to: r.graduated ? "Graduated" : label(r.toClassId, r.toSectionId),
          date: r.promotedAt.toISOString().slice(0, 10),
        })),
        summary: [
          { label: "Records", value: String(records.length) },
          {
            label: "Graduated",
            value: String(records.filter((r) => r.graduated).length),
          },
        ],
      };
    });
  }
}
