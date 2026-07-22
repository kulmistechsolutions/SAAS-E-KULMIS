import type { PrismaClient } from "@prisma/client";
import { nextStudentCode, padCode } from "./code-allocator";

/**
 * Codes are monotonic: a deleted student's number is never handed out again.
 * The counter remembers the high-water mark, so even deleting the top student
 * does not let the next registration reuse that number. Only a deliberate
 * reset (which zeroes the counter and clears the rows) restarts numbering.
 */

function fakeTx(opts: { studentCodes: string[]; counter?: number }): {
  tx: PrismaClient;
  counterValue: () => number | undefined;
} {
  let counter = opts.counter;
  const tx = {
    student: {
      findMany: async () => opts.studentCodes.map((code) => ({ code })),
    },
    counter: {
      findUnique: async () =>
        counter === undefined ? null : { value: counter },
      upsert: async ({ update }: { update: { value: number } }) => {
        counter = update.value;
        return { value: counter };
      },
    },
  } as unknown as PrismaClient;
  return { tx, counterValue: () => counter };
}

describe("code allocator (monotonic)", () => {
  it("starts at 1 for an empty school", async () => {
    const { tx } = fakeTx({ studentCodes: [] });
    const { code, sequence } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0001");
    expect(sequence).toBe(1);
  });

  it("takes the next number above the highest in use", async () => {
    const { tx } = fakeTx({
      studentCodes: ["STU0001", "STU0002", "STU0003"],
      counter: 3,
    });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0004");
  });

  it("does NOT fill a gap left by a deleted middle student", async () => {
    // STU0002 was deleted; the next student must not reuse it.
    const { tx } = fakeTx({
      studentCodes: ["STU0001", "STU0003", "STU0004"],
      counter: 4,
    });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0005");
  });

  it("does NOT reuse the top number after the highest student is deleted", async () => {
    // Students went up to STU0010, then STU0010 was deleted. The counter still
    // remembers 10, so the next student is STU0011 — not a reused STU0010.
    const { tx } = fakeTx({
      studentCodes: ["STU0001", "STU0009"],
      counter: 10,
    });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0011");
  });

  it("self-heals when the counter drifted below the real max", async () => {
    // Rows exist up to STU0007 but the counter says 3 (drift / old scheme).
    // The next code must clear the real max, not collide at STU0004.
    const { tx } = fakeTx({
      studentCodes: ["STU0005", "STU0007"],
      counter: 3,
    });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0008");
  });

  it("restarts at 1 once the counter is reset and rows are cleared", async () => {
    const { tx } = fakeTx({ studentCodes: [], counter: 0 });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0001");
  });

  it("ignores codes from another prefix or with no numeric suffix", async () => {
    const { tx } = fakeTx({
      studentCodes: ["PAR0009", "STU0002", "STUABC"],
      counter: 2,
    });
    const { code } = await nextStudentCode(tx, "s1", "STU");
    expect(code).toBe("STU0003");
  });

  it("pads to four digits and keeps going past 9999", async () => {
    expect(padCode(7)).toBe("0007");
    const { tx } = fakeTx({ studentCodes: ["STU9999"], counter: 9999 });
    const { code, sequence } = await nextStudentCode(tx, "s1", "STU");
    expect(sequence).toBe(10000);
    expect(code).toBe("STU10000");
  });
});
