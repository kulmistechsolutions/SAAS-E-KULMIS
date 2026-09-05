import { FeesService } from "./fees.service";

/**
 * Who an extra fee actually reaches.
 *
 * An extra fee can be aimed at the whole school, at chosen classes, or at one
 * named child, and each has its own price. Getting this wrong bills families
 * who owe nothing — so the three shapes are pinned here rather than left to be
 * discovered by a school reading its own invoices.
 */

type Fee = {
  id: string;
  studentId: string | null;
  appliesToAllClasses: boolean;
  defaultAmount: number | null;
  classAmounts: { classId: string; amount: number }[];
};

const STUDENTS = [
  { id: "st1", code: "S001", fullName: "Amina Cali", classId: "c8", class: { name: "8th" } },
  { id: "st2", code: "S002", fullName: "Bashir Nuur", classId: "c8", class: { name: "8th" } },
  { id: "st3", code: "S003", fullName: "Caasho Xasan", classId: "c9", class: { name: "9th" } },
];

/** Stands in for the tenant client, answering the three reads this makes. */
function txFor(fee: Fee, alreadyCharged: string[] = []) {
  return {
    extraFee: { findFirst: () => Promise.resolve(fee) },
    student: {
      findMany: ({
        where,
      }: {
        where: { id?: string; classId?: { in: string[] } };
      }) =>
        Promise.resolve(
          STUDENTS.filter((s) => {
            if (where.id) return s.id === where.id;
            if (where.classId) return where.classId.in.includes(s.classId);
            return true;
          }),
        ),
    },
    feeCharge: {
      findMany: () =>
        Promise.resolve(alreadyCharged.map((studentId) => ({ studentId }))),
    },
  };
}

// resolveExtraFeeTargets reads only from the tx handed to it, so the service's
// own dependencies are never touched here.
const service = new (FeesService as unknown as new () => FeesService)() as unknown as {
  resolveExtraFeeTargets(
    tx: unknown,
    id: string,
  ): Promise<{
    targets: { studentId: string; amount: number; alreadyCharged: boolean }[];
    studentCount: number;
    pendingCount: number;
    totalAmount: number;
  }>;
};

const resolve = (fee: Fee, alreadyCharged: string[] = []) =>
  service.resolveExtraFeeTargets(txFor(fee, alreadyCharged), fee.id);

describe("who an extra fee reaches", () => {
  it("bills every active student at one price when it applies to all classes", async () => {
    const r = await resolve({
      id: "f1",
      studentId: null,
      appliesToAllClasses: true,
      defaultAmount: 10,
      classAmounts: [],
    });
    expect(r.studentCount).toBe(3);
    expect(r.targets.every((t) => t.amount === 10)).toBe(true);
    expect(r.totalAmount).toBe(30);
  });

  it("bills only the chosen classes, each at its own price", async () => {
    const r = await resolve({
      id: "f2",
      studentId: null,
      appliesToAllClasses: false,
      defaultAmount: null,
      classAmounts: [{ classId: "c9", amount: 7 }],
    });
    expect(r.targets.map((t) => t.studentId)).toEqual(["st3"]);
    expect(r.totalAmount).toBe(7);
  });

  describe("a fee for one named child", () => {
    // A resit paper, a replaced book, a trip only they went on. Before this
    // the only way to bill it was to invent a one-class fee, which charged
    // everybody else in that class too.
    const oneChild: Fee = {
      id: "f3",
      studentId: "st2",
      appliesToAllClasses: false,
      defaultAmount: 15,
      classAmounts: [],
    };

    it("reaches that child and nobody else", async () => {
      const r = await resolve(oneChild);
      expect(r.targets.map((t) => t.studentId)).toEqual(["st2"]);
      expect(r.studentCount).toBe(1);
    });

    it("prices them from the fee's own amount", async () => {
      const r = await resolve(oneChild);
      expect(r.targets[0]!.amount).toBe(15);
      expect(r.totalAmount).toBe(15);
    });

    it("never reaches a classmate, even one in the same class", async () => {
      const r = await resolve(oneChild);
      expect(r.targets.map((t) => t.studentId)).not.toContain("st1");
    });
  });

  it("does not bill anyone twice when applied again", async () => {
    // Apply is meant to be safe to retry: a partial failure should top up the
    // rest, not charge the ones that already went through a second time.
    const r = await resolve(
      {
        id: "f4",
        studentId: null,
        appliesToAllClasses: true,
        defaultAmount: 10,
        classAmounts: [],
      },
      ["st1", "st2"],
    );
    expect(r.studentCount).toBe(3);
    expect(r.pendingCount).toBe(1);
    expect(r.totalAmount).toBe(10);
  });
});
