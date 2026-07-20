import { TeacherAssignmentsService } from "./teacher-assignments.service";

/**
 * Real scenario: a school runs one class as a morning group and an afternoon
 * group under the SAME class name (two Sections, each carrying its own
 * shift). A "whole class" assignment (no section chosen) would silently cover
 * both shifts' sections with one teacher — this is the bug being fixed, and
 * these specs prove the guard catches it without blocking the cases that are
 * genuinely fine.
 */

const CLASSES = {
  c1: { id: "c1", name: "8A", shiftId: null }, // multi-shift class
  c2: { id: "c2", name: "8B", shiftId: "sh1" }, // single-shift class
  c3: { id: "c3", name: "8C", shiftId: null }, // no sections at all
  c4: { id: "c4", name: "8D", shiftId: null }, // mixed but one section inactive
};

const SECTIONS = [
  // c1: two ACTIVE sections, different shifts — genuinely ambiguous.
  { id: "s1a", classId: "c1", status: "ACTIVE", shiftId: "sh1" },
  { id: "s1b", classId: "c1", status: "ACTIVE", shiftId: "sh2" },
  // c2: two ACTIVE sections, both fall back to the class's own shift — fine.
  { id: "s2a", classId: "c2", status: "ACTIVE", shiftId: null },
  { id: "s2b", classId: "c2", status: "ACTIVE", shiftId: null },
  // c4: one ACTIVE (sh1), one INACTIVE (sh2) — the inactive one must not count.
  { id: "s4a", classId: "c4", status: "ACTIVE", shiftId: "sh1" },
  { id: "s4b", classId: "c4", status: "INACTIVE", shiftId: "sh2" },
];

function fakePrisma() {
  const created: unknown[] = [];
  const tx = {
    teacher: { findFirst: () => Promise.resolve({ id: "t1" }) },
    academicYear: { findFirst: () => Promise.resolve({ id: "y1" }) },
    subject: {
      findFirst: () => Promise.resolve({ id: "sub1" }),
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => ({ id }))),
    },
    class: {
      findFirst: ({ where }: { where: { id: string } }) =>
        Promise.resolve(
          (CLASSES as Record<string, { id: string; name: string; shiftId: string | null }>)[
            where.id
          ] ?? null,
        ),
      findMany: ({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(
          Object.values(CLASSES).filter((c) => where.id.in.includes(c.id)),
        ),
    },
    section: {
      findFirst: ({ where }: { where: { id: string; classId: string } }) =>
        Promise.resolve(
          SECTIONS.find((s) => s.id === where.id && s.classId === where.classId) ??
            null,
        ),
      findMany: ({
        where,
      }: {
        where: {
          classId?: { in: string[] };
          status?: string;
          id?: { in: string[] };
        };
      }) => {
        // createBulk's own FK check queries by section id; the multi-shift
        // guard queries by classId + status. Same fake, two call shapes.
        if (where.id) {
          return Promise.resolve(
            SECTIONS.filter((s) => where.id!.in.includes(s.id)),
          );
        }
        return Promise.resolve(
          SECTIONS.filter(
            (s) =>
              where.classId!.in.includes(s.classId) && s.status === where.status,
          ),
        );
      },
    },
    teacherAssignment: {
      findFirst: () => Promise.resolve(null),
      findMany: () => Promise.resolve([]),
      create: (args: { data: unknown }) => {
        created.push(args.data);
        return Promise.resolve({ id: `a${created.length}`, ...args.data as object });
      },
      createMany: (args: { data: unknown[] }) => {
        created.push(...args.data);
        return Promise.resolve({ count: args.data.length });
      },
    },
  };
  return {
    prisma: {
      forTenant: <T>(
        _schoolId: string,
        fn: (t: unknown) => Promise<T>,
        _opts?: unknown,
      ) => fn(tx),
    },
    created,
  };
}

describe("TeacherAssignmentsService — multi-shift class guard", () => {
  it("blocks a whole-class assignment when the class's sections span two shifts", async () => {
    const { prisma } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    await expect(
      service.create("sc1", {
        teacherId: "t1",
        academicYearId: "y1",
        classId: "c1",
        subjectId: "sub1",
      } as never),
    ).rejects.toThrow(/8A has sections in different shifts/);
  });

  it("allows a section-scoped assignment on that same multi-shift class", async () => {
    const { prisma, created } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    await service.create("sc1", {
      teacherId: "t1",
      academicYearId: "y1",
      classId: "c1",
      sectionId: "s1a",
      subjectId: "sub1",
    } as never);
    expect(created).toHaveLength(1);
  });

  it("allows a whole-class assignment when every section shares one shift", async () => {
    const { prisma, created } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    await service.create("sc1", {
      teacherId: "t1",
      academicYearId: "y1",
      classId: "c2",
      subjectId: "sub1",
    } as never);
    expect(created).toHaveLength(1);
  });

  it("allows a whole-class assignment when the class has no sections", async () => {
    const { prisma, created } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    await service.create("sc1", {
      teacherId: "t1",
      academicYearId: "y1",
      classId: "c3",
      subjectId: "sub1",
    } as never);
    expect(created).toHaveLength(1);
  });

  it("ignores an inactive section when judging whether shifts are mixed", async () => {
    const { prisma, created } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    // c4 has one ACTIVE (sh1) and one INACTIVE (sh2) section — only the
    // active one should count, so this must be allowed.
    await service.create("sc1", {
      teacherId: "t1",
      academicYearId: "y1",
      classId: "c4",
      subjectId: "sub1",
    } as never);
    expect(created).toHaveLength(1);
  });

  it("applies the same guard to bulk assignment", async () => {
    const { prisma } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    await expect(
      service.createBulk("sc1", {
        teacherId: "t1",
        academicYearId: "y1",
        items: [
          { classId: "c2", subjectId: "sub1" }, // fine on its own
          { classId: "c1", subjectId: "sub1" }, // the ambiguous one
        ],
      } as never),
    ).rejects.toThrow(/8A has sections in different shifts/);
  });

  it("bulk assignment still allows mixing a section-scoped row for the multi-shift class", async () => {
    const { prisma, created } = fakePrisma();
    const service = new TeacherAssignmentsService(prisma as never);
    const res = await service.createBulk("sc1", {
      teacherId: "t1",
      academicYearId: "y1",
      items: [
        { classId: "c2", subjectId: "sub1" },
        { classId: "c1", sectionId: "s1a", subjectId: "sub1" },
      ],
    } as never);
    expect(res.createdCount).toBe(2);
    expect(created).toHaveLength(2);
  });
});
