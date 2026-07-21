import type { PrismaClient } from "@prisma/client";
import { nextParentCode, nextStudentCode, padCode } from "./code-allocator";

/**
 * The point of these tests is the rule the school asked for: when a class is
 * wiped, the IDs it used come back. A monotonic counter would keep climbing
 * and leave holes in the register, which is exactly what they were fixing by
 * deleting the grade in the first place.
 */

function txWithStudentCodes(codes: string[]): PrismaClient {
  return {
    student: { findMany: async () => codes.map((code) => ({ code })) },
    parent: { findMany: async () => codes.map((code) => ({ code })) },
  } as unknown as PrismaClient;
}

describe("code allocator", () => {
  it("starts at 1 for an empty school", async () => {
    const { code, sequence } = await nextStudentCode(
      txWithStudentCodes([]),
      "STU",
    );
    expect(code).toBe("STU0001");
    expect(sequence).toBe(1);
  });

  it("takes the next number when the register is contiguous", async () => {
    const { code } = await nextStudentCode(
      txWithStudentCodes(["STU0001", "STU0002", "STU0003"]),
      "STU",
    );
    expect(code).toBe("STU0004");
  });

  it("fills a hole left by a purged class", async () => {
    // Grade 7 was erased; STU0002 and STU0003 went with it.
    const { code } = await nextStudentCode(
      txWithStudentCodes(["STU0001", "STU0004"]),
      "STU",
    );
    expect(code).toBe("STU0002");
  });

  it("reissues from 1 when every student was deleted", async () => {
    const { code } = await nextStudentCode(txWithStudentCodes([]), "STU");
    expect(code).toBe("STU0001");
  });

  it("ignores codes that belong to another prefix", async () => {
    const { code } = await nextStudentCode(
      txWithStudentCodes(["PAR0001", "PAR0002", "STU0001"]),
      "STU",
    );
    expect(code).toBe("STU0002");
  });

  it("ignores codes with a non-numeric suffix", async () => {
    const { code } = await nextStudentCode(
      txWithStudentCodes(["STU0001", "STUABC", "STU-7"]),
      "STU",
    );
    expect(code).toBe("STU0002");
  });

  it("keeps counting past four digits", async () => {
    const codes = Array.from({ length: 9999 }, (_, i) => `STU${padCode(i + 1)}`);
    const { code, sequence } = await nextStudentCode(
      txWithStudentCodes(codes),
      "STU",
    );
    expect(sequence).toBe(10000);
    expect(code).toBe("STU10000");
  });

  it("applies the same reuse rule to parents", async () => {
    const { code } = await nextParentCode(
      txWithStudentCodes(["PAR0001", "PAR0003"]),
      "PAR",
    );
    expect(code).toBe("PAR0002");
  });
});
