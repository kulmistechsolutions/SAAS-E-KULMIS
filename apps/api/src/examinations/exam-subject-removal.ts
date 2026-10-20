import type { Prisma } from "@prisma/client";

type Tx = Prisma.TransactionClient;

export interface RemovedExamSubject {
  subjectId: string;
  name: string;
  /** Marks that had been entered for it (blank cells are not counted). */
  marksRemoved: number;
}

/** Most marks one audit entry will carry as a snapshot. */
export const SNAPSHOT_LIMIT = 4000;

/**
 * Take subjects off an exam as if they had never been on it.
 *
 * Several results calculations read every mark held against an exam rather
 * than only the marks of subjects still on it, so leaving a removed subject's
 * marks behind would keep counting them in students' totals. They are
 * therefore deleted with the subject, in the same step, and returned as a
 * snapshot for the audit log so nothing is unrecoverable.
 *
 * Callers decide who may do this and whether the exam may lose the subject.
 */
export async function removeSubjectsFromExam(
  tx: Tx,
  examId: string,
  subjectIds: string[],
): Promise<{ removed: RemovedExamSubject[]; snapshot: [string, string, number][] }> {
  const rows = await tx.examSubject.findMany({
    where: { examId, subjectId: { in: subjectIds } },
    select: { subjectId: true, subject: { select: { name: true } } },
  });
  if (rows.length === 0) return { removed: [], snapshot: [] };
  const ids = rows.map((r) => r.subjectId);

  const marks = await tx.examMark.findMany({
    where: { examId, subjectId: { in: ids } },
    select: { studentId: true, subjectId: true, marks: true },
  });
  await tx.examMark.deleteMany({ where: { examId, subjectId: { in: ids } } });
  await tx.examSubject.deleteMany({ where: { examId, subjectId: { in: ids } } });

  const entered = marks.filter((m) => m.marks !== null);
  const removed = rows.map((r) => ({
    subjectId: r.subjectId,
    name: r.subject.name,
    marksRemoved: entered.filter((m) => m.subjectId === r.subjectId).length,
  }));
  const snapshot = entered
    .slice(0, SNAPSHOT_LIMIT)
    .map((m) => [m.studentId, m.subjectId, m.marks as number] as [string, string, number]);
  return { removed, snapshot };
}
