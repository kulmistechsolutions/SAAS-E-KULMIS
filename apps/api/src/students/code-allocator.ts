import type { PrismaClient } from "@prisma/client";

/**
 * Student and parent codes are `${prefix}${paddedNumber}` (e.g. `STU0007`).
 *
 * Numbers are *reused*: when a class is purged and its students are deleted,
 * their codes become free again and the next registration takes the lowest
 * free one — the school gets a clean run of IDs back, exactly as if the
 * deleted students had never existed. A monotonic counter cannot do this,
 * so the counter is kept only as a high-water mark for reporting.
 */

const PAD_WIDTH = 4;

export function padCode(n: number): string {
  return String(n).padStart(PAD_WIDTH, "0");
}

/** Pull the numeric suffix out of a code, or null if it doesn't have one. */
function suffixOf(code: string, prefix: string): number | null {
  if (!code.startsWith(prefix)) return null;
  const rest = code.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  const n = Number(rest);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

/** The lowest positive integer not present in `taken`. */
function lowestFree(taken: Set<number>): number {
  let n = 1;
  while (taken.has(n)) n++;
  return n;
}

/**
 * Next free student code for a school. Runs inside the caller's tenant
 * transaction so the read and the following insert see the same rows.
 */
export async function nextStudentCode(
  tx: PrismaClient,
  prefix: string,
): Promise<{ code: string; sequence: number }> {
  const rows = await tx.student.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const taken = new Set<number>();
  for (const r of rows) {
    const n = suffixOf(r.code, prefix);
    if (n !== null) taken.add(n);
  }
  const sequence = lowestFree(taken);
  return { code: `${prefix}${padCode(sequence)}`, sequence };
}

/** Next free parent code for a school. Same reuse rule as students. */
export async function nextParentCode(
  tx: PrismaClient,
  prefix: string,
): Promise<{ code: string; sequence: number }> {
  const rows = await tx.parent.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  const taken = new Set<number>();
  for (const r of rows) {
    const n = suffixOf(r.code, prefix);
    if (n !== null) taken.add(n);
  }
  const sequence = lowestFree(taken);
  return { code: `${prefix}${padCode(sequence)}`, sequence };
}

/**
 * Keep the counter at the high-water mark. It no longer drives allocation,
 * but other code (and admins) read it, so it must never go backwards past
 * what is actually in use.
 */
export async function syncCounter(
  tx: PrismaClient,
  schoolId: string,
  name: "student" | "parent",
  sequence: number,
): Promise<void> {
  const existing = await tx.counter.findUnique({
    where: { schoolId_name: { schoolId, name } },
    select: { value: true },
  });
  if (!existing) {
    await tx.counter.create({ data: { schoolId, name, value: sequence } });
    return;
  }
  if (existing.value < sequence) {
    await tx.counter.update({
      where: { schoolId_name: { schoolId, name } },
      data: { value: sequence },
    });
  }
}
