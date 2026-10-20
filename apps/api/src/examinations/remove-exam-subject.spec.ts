import { BadRequestException, NotFoundException } from "@nestjs/common";
import { ExaminationsService } from "./examinations.service";
import { removeSubjectsFromExam } from "./exam-subject-removal";
import { ClassSubjectService } from "../academics/class-subject.service";

/**
 * Taking a subject off an exam must leave the exam as if the subject had
 * never been on it: students are not calculated for it, nothing else moves,
 * and what was removed is recoverable from the audit log.
 */
function fakeTx(opts: {
  subjects: { subjectId: string; name: string }[];
  marks: { studentId: string; subjectId: string; marks: number | null }[];
  status?: string;
}) {
  const state = {
    subjects: [...opts.subjects],
    marks: [...opts.marks],
  };
  const tx = {
    exam: {
      findFirst: jest.fn().mockImplementation(() =>
        Promise.resolve({
          id: "e1",
          status: opts.status ?? "OPEN",
          subjects: state.subjects.map((s) => ({ subjectId: s.subjectId })),
        }),
      ),
    },
    examSubject: {
      findMany: jest.fn(({ where }: { where: { subjectId: { in: string[] } } }) =>
        Promise.resolve(
          state.subjects
            .filter((s) => where.subjectId.in.includes(s.subjectId))
            .map((s) => ({ subjectId: s.subjectId, subject: { name: s.name } })),
        ),
      ),
      deleteMany: jest.fn(({ where }: { where: { subjectId: { in: string[] } } }) => {
        state.subjects = state.subjects.filter((s) => !where.subjectId.in.includes(s.subjectId));
        return Promise.resolve({});
      }),
    },
    examMark: {
      findMany: jest.fn(({ where }: { where: { subjectId: { in: string[] } } }) =>
        Promise.resolve(state.marks.filter((m) => where.subjectId.in.includes(m.subjectId))),
      ),
      deleteMany: jest.fn(({ where }: { where: { subjectId: { in: string[] } } }) => {
        state.marks = state.marks.filter((m) => !where.subjectId.in.includes(m.subjectId));
        return Promise.resolve({});
      }),
    },
  };
  return { tx, state };
}

const SUBJECTS = [
  { subjectId: "maths", name: "Maths" },
  { subjectId: "phys", name: "Physics" },
  { subjectId: "chem", name: "Chemistry" },
];
const MARKS = [
  { studentId: "s1", subjectId: "maths", marks: 80 },
  { studentId: "s2", subjectId: "maths", marks: 70 },
  { studentId: "s1", subjectId: "phys", marks: 55 },
  { studentId: "s2", subjectId: "phys", marks: null }, // an empty cell is not a mark
  { studentId: "s3", subjectId: "phys", marks: 60 },
];

describe("the removal helper", () => {
  it("deletes the subject and every mark held for it, and nothing else", async () => {
    const { tx, state } = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    const r = await removeSubjectsFromExam(tx as never, "e1", ["phys"]);
    expect(state.subjects.map((s) => s.subjectId)).toEqual(["maths", "chem"]);
    expect(state.marks.every((m) => m.subjectId === "maths")).toBe(true);
    expect(state.marks).toHaveLength(2);
    expect(r.removed).toEqual([{ subjectId: "phys", name: "Physics", marksRemoved: 2 }]);
  });

  it("snapshots the entered marks (not the blanks) so they can be restored", async () => {
    const { tx } = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    const r = await removeSubjectsFromExam(tx as never, "e1", ["phys"]);
    expect(r.snapshot).toEqual([["s1", "phys", 55], ["s3", "phys", 60]]);
  });

  it("does nothing for a subject that is not on the exam", async () => {
    const { tx, state } = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    const r = await removeSubjectsFromExam(tx as never, "e1", ["biology"]);
    expect(r.removed).toEqual([]);
    expect(state.marks).toHaveLength(MARKS.length);
  });
});

function examService(tx: ReturnType<typeof fakeTx>["tx"]) {
  const prisma = { forTenant: (_s: string, fn: (t: typeof tx) => unknown) => fn(tx) };
  const svc = new ExaminationsService(
    prisma as never, {} as never, {} as never, {} as never, {} as never,
    {} as never, {} as never, {} as never, {} as never,
  );
  const refresh = jest.spyOn(svc as never, "refreshSubmissionStatuses" as never).mockResolvedValue(undefined as never);
  const audit = jest.spyOn(svc as never, "recordExamAudit" as never).mockResolvedValue(undefined as never);
  return { svc, refresh, audit };
}

describe("removing a subject from an exam", () => {
  it("removes it with its marks and recomputes submission statuses", async () => {
    const { tx, state } = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    const { svc, refresh } = examService(tx);
    const r = await svc.removeExamSubject("s", "e1", "phys");
    expect(r.removed[0]).toMatchObject({ name: "Physics", marksRemoved: 2 });
    expect(state.marks.some((m) => m.subjectId === "phys")).toBe(false);
    expect(refresh).toHaveBeenCalledWith(tx, "s", "e1");
  });

  it("works on an exam that already has marks entered, whatever its status", async () => {
    for (const status of ["OPEN", "LOCKED", "PUBLISHED", "DRAFT"]) {
      const { tx } = fakeTx({ subjects: SUBJECTS, marks: MARKS, status });
      const { svc } = examService(tx);
      await expect(svc.removeExamSubject("s", "e1", "maths")).resolves.toBeDefined();
    }
  });

  it("writes the removed marks to the audit log", async () => {
    const { tx } = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    const { svc, audit } = examService(tx);
    await svc.removeExamSubject("s", "e1", "phys", { userId: "u", username: "admin", role: "ADMINISTRATOR" });
    expect(audit).toHaveBeenCalledWith(
      "s", expect.anything(), "EXAM_SUBJECT_REMOVED", "e1",
      expect.objectContaining({
        subjects: ["Physics"],
        marksRemoved: 2,
        marks: [["s1", "phys", 55], ["s3", "phys", 60]],
      }),
    );
  });

  it("refuses to take the last subject off an exam", async () => {
    const { tx, state } = fakeTx({ subjects: [SUBJECTS[0]!], marks: MARKS });
    const { svc } = examService(tx);
    await expect(svc.removeExamSubject("s", "e1", "maths")).rejects.toThrow(BadRequestException);
    expect(state.marks).toHaveLength(MARKS.length);
  });

  it("refuses an archived exam and a subject that is not on it", async () => {
    const a = fakeTx({ subjects: SUBJECTS, marks: MARKS, status: "ARCHIVED" });
    await expect(examService(a.tx).svc.removeExamSubject("s", "e1", "phys")).rejects.toThrow(BadRequestException);
    const b = fakeTx({ subjects: SUBJECTS, marks: MARKS });
    await expect(examService(b.tx).svc.removeExamSubject("s", "e1", "biology")).rejects.toThrow(NotFoundException);
  });
});

describe("removing a subject from a class", () => {
  function setup(exams: { id: string; subjects: number }[]) {
    const removedFromExam: string[] = [];
    const tx = {
      classSubject: {
        findFirst: jest.fn().mockResolvedValue({ id: "cs1", classId: "c1", subjectId: "phys", subject: { name: "Physics" } }),
        delete: jest.fn().mockResolvedValue({}),
      },
      exam: { findMany: jest.fn().mockResolvedValue(exams.map((e) => ({ id: e.id, _count: { subjects: e.subjects } }))) },
      examSubject: {
        findMany: jest.fn().mockImplementation(() => Promise.resolve([{ subjectId: "phys", subject: { name: "Physics" } }])),
        deleteMany: jest.fn().mockImplementation(({ where }: { where: { examId: string } }) => {
          removedFromExam.push(where.examId);
          return Promise.resolve({});
        }),
      },
      examMark: {
        findMany: jest.fn().mockResolvedValue([{ studentId: "s1", subjectId: "phys", marks: 50 }]),
        deleteMany: jest.fn().mockResolvedValue({}),
      },
    };
    const prisma = { forTenant: (_s: string, fn: (t: typeof tx) => unknown) => fn(tx) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    return { svc: new ClassSubjectService(prisma as never, audit as never), tx, audit, removedFromExam };
  }

  it("leaves the class's exams alone by default", async () => {
    const { svc, tx, removedFromExam } = setup([{ id: "e1", subjects: 5 }]);
    await svc.remove("s", "cs1");
    expect(tx.classSubject.delete).toHaveBeenCalled();
    expect(removedFromExam).toEqual([]);
  });

  it("can also take it off the class's exams, marks and all, and says so in the audit log", async () => {
    const { svc, audit, removedFromExam } = setup([{ id: "e1", subjects: 5 }, { id: "e2", subjects: 3 }]);
    const r = await svc.remove("s", "cs1", { alsoFromExams: true });
    expect(removedFromExam).toEqual(["e1", "e2"]);
    expect(r).toMatchObject({ removedFromExams: 2, marksRemoved: 2 });
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ action: "CLASS_SUBJECT_REMOVED_WITH_EXAMS" }));
  });

  it("never strips an exam of its only subject", async () => {
    const { svc, tx, removedFromExam } = setup([{ id: "e1", subjects: 1 }]);
    const r = await svc.remove("s", "cs1", { alsoFromExams: true });
    expect(removedFromExam).toEqual([]);
    expect(r.removedFromExams).toBe(0);
    expect(tx.classSubject.delete).toHaveBeenCalled(); // the class still lets it go
  });
});
