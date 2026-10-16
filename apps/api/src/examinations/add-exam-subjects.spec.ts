import { BadRequestException } from "@nestjs/common";
import { ExaminationsService } from "./examinations.service";

/**
 * A subject left off an exam used to mean deleting the exam — and every mark
 * already in it — and making it again. Adding the missing subject must leave
 * everything already on the exam exactly as it was.
 */
function setup(exam: Record<string, unknown> | null) {
  const created: unknown[] = [];
  const tx = {
    exam: { findFirst: jest.fn().mockResolvedValue(exam) },
    subject: {
      findMany: jest.fn(({ where }: { where: { id: { in: string[] } } }) =>
        Promise.resolve(where.id.in.map((id) => ({ id, name: id.toUpperCase() }))),
      ),
    },
    teacherAssignment: {
      findMany: jest.fn().mockResolvedValue([
        { subjectId: "physics", sectionId: null, teacherId: "t-class" },
        { subjectId: "physics", sectionId: "sec-a", teacherId: "t-section" },
      ]),
    },
    examSubject: {
      createMany: jest.fn(({ data }: { data: unknown[] }) => {
        created.push(...data);
        return Promise.resolve({ count: data.length });
      }),
    },
    examMark: { deleteMany: jest.fn() },
  };
  const prisma = { forTenant: (_s: string, fn: (t: typeof tx) => unknown) => fn(tx) };
  const svc = new ExaminationsService(
    prisma as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never,
  );
  // The audit trail is covered elsewhere; here it only has to be called.
  const audit = jest.spyOn(svc as never, "recordExamAudit" as never).mockResolvedValue(undefined as never);
  return { svc, tx, created, audit };
}

const EXAM = {
  id: "e1", status: "OPEN", classId: "g11", sectionId: "sec-a", academicYearId: "y1",
  subjects: [{ subjectId: "maths" }],
};

describe("adding a missing subject to an exam", () => {
  it("adds only the subjects not already on it", async () => {
    const { svc, created } = setup(EXAM);
    const r = await svc.addExamSubjects("s", "e1", ["maths", "physics", "physics"]);
    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({ examId: "e1", subjectId: "physics" });
    expect(r.added.map((a) => a.subjectId)).toEqual(["physics"]);
  });

  it("gives the subject the section's teacher before the class's", async () => {
    const { svc, created } = setup(EXAM);
    await svc.addExamSubjects("s", "e1", ["physics"]);
    expect(created[0]).toMatchObject({ teacherId: "t-section" });
  });

  it("never deletes or rewrites anything already on the exam", async () => {
    const { svc, tx } = setup(EXAM);
    await svc.addExamSubjects("s", "e1", ["physics"]);
    expect(tx.examMark.deleteMany).not.toHaveBeenCalled();
  });

  it("does nothing when every subject is already there", async () => {
    const { svc, created, audit } = setup(EXAM);
    const r = await svc.addExamSubjects("s", "e1", ["maths"]);
    expect(created).toHaveLength(0);
    expect(r.added).toEqual([]);
    expect(audit).not.toHaveBeenCalled();
  });

  it("refuses an archived exam", async () => {
    const { svc } = setup({ ...EXAM, status: "ARCHIVED" });
    await expect(svc.addExamSubjects("s", "e1", ["physics"])).rejects.toThrow(BadRequestException);
  });

  it("is recorded in the audit log", async () => {
    const { svc, audit } = setup(EXAM);
    await svc.addExamSubjects("s", "e1", ["physics"]);
    expect(audit).toHaveBeenCalledWith("s", undefined, "EXAM_SUBJECTS_ADDED", "e1", { subjects: ["PHYSICS"] });
  });
});
