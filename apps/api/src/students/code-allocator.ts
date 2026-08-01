import type { PrismaClient } from "@prisma/client";

/**
 * Student and parent codes are `${prefix}${paddedNumber}` (e.g. `STU0007`).
 *
 * Numbers are **monotonic** — like a real school register. A deleted student's
 * number is retired, never handed to someone new; the next registration always
 * takes a higher number. Gaps left by deletions stay as gaps. The only way the
 * numbering restarts is a deliberate reset from Settings (see
 * [[school-reset.service]]), which zeroes the counter.
 *
 * A per-school Counter row holds the high-water mark. Each allocation also
 * consults the highest code actually in use and takes `max(counter, maxUsed)+1`,
 * so the counter self-heals from any drift (e.g. rows imported out of band, or
 * the earlier lowest-free scheme) and a new code can never collide with an
 * existing one — even right after the highest student was deleted.
 */

/** Used only where no school-configured width is available (e.g. tests). */
const DEFAULT_PAD_WIDTH = 4;

export function padCode(n: number, width: number = DEFAULT_PAD_WIDTH): string {
  return String(n).padStart(width, "0");
}

/** Pull the numeric suffix out of a code, or null if it doesn't have one. */
function suffixOf(code: string, prefix: string): number | null {
  if (!code.startsWith(prefix)) return null;
  const rest = code.slice(prefix.length);
  if (!/^\d+$/.test(rest)) return null;
  const n = Number(rest);
  return Number.isSafeInteger(n) && n > 0 ? n : null;
}

async function highestStudentSuffix(
  tx: PrismaClient,
  prefix: string,
): Promise<number> {
  const rows = await tx.student.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = suffixOf(r.code, prefix);
    if (n !== null && n > max) max = n;
  }
  return max;
}

async function highestParentSuffix(
  tx: PrismaClient,
  prefix: string,
): Promise<number> {
  const rows = await tx.parent.findMany({
    where: { code: { startsWith: prefix } },
    select: { code: true },
  });
  let max = 0;
  for (const r of rows) {
    const n = suffixOf(r.code, prefix);
    if (n !== null && n > max) max = n;
  }
  return max;
}

async function allocate(
  tx: PrismaClient,
  schoolId: string,
  name: "student" | "parent",
  prefix: string,
  maxUsed: number,
  idLength: number,
): Promise<{ code: string; sequence: number }> {
  const counter = await tx.counter.findUnique({
    where: { schoolId_name: { schoolId, name } },
    select: { value: true },
  });
  const sequence = Math.max(counter?.value ?? 0, maxUsed) + 1;
  await tx.counter.upsert({
    where: { schoolId_name: { schoolId, name } },
    create: { schoolId, name, value: sequence },
    update: { value: sequence },
  });
  return { code: `${prefix}${padCode(sequence, idLength)}`, sequence };
}

/**
 * Next student code for a school. Runs inside the caller's tenant transaction
 * so the read and the following insert see the same rows. `idLength` is the
 * school's own Settings > Students > "ID Length (padding)" — only new codes
 * take a changed value; existing codes keep the width they were given.
 */
export async function nextStudentCode(
  tx: PrismaClient,
  schoolId: string,
  prefix: string,
  idLength: number = DEFAULT_PAD_WIDTH,
): Promise<{ code: string; sequence: number }> {
  const maxUsed = await highestStudentSuffix(tx, prefix);
  return allocate(tx, schoolId, "student", prefix, maxUsed, idLength);
}

/** Next parent code for a school. Same monotonic rule as students. */
export async function nextParentCode(
  tx: PrismaClient,
  schoolId: string,
  prefix: string,
  idLength: number = DEFAULT_PAD_WIDTH,
): Promise<{ code: string; sequence: number }> {
  const maxUsed = await highestParentSuffix(tx, prefix);
  return allocate(tx, schoolId, "parent", prefix, maxUsed, idLength);
}

/**
 * Zero a school's counter so its numbering starts again from 1. Used only by
 * the deliberate reset in Settings, after the matching rows have been deleted.
 */
export async function resetCounter(
  tx: PrismaClient,
  schoolId: string,
  name: "student" | "parent" | "teacher",
): Promise<void> {
  await tx.counter.upsert({
    where: { schoolId_name: { schoolId, name } },
    create: { schoolId, name, value: 0 },
    update: { value: 0 },
  });
}
