import { ensureLiveMonthCharge } from "./students.service";

/**
 * The month a student becomes billable in has to be raised for them.
 *
 * Month setup charges whoever is billable in the class at the moment it runs,
 * and it skips a waived student entirely — it does not leave a zero row
 * behind. So a student taken off Free afterwards, or given a fee they did not
 * have, had nothing to reprice: the desk read "$16.00 monthly fee, $0.00
 * outstanding" and the family was never asked for the money. Three students at
 * HANUUNIYE were sitting like that when this was found.
 */

interface Charge {
  studentId: string;
  year: number;
  month: number;
  kind: string;
  amount: number;
  status: string;
}

function txWith(opts: {
  activations: { classId: string; year: number; month: number }[];
  charges?: Charge[];
}) {
  const created: Charge[] = [];
  const charges = opts.charges ?? [];
  const tx = {
    monthlyFeeActivation: {
      findFirst: ({ where }: { where?: { classId?: string } } = {}) => {
        const mine = opts.activations
          .filter((a) => !where?.classId || a.classId === where.classId)
          .sort((a, b) => b.year * 100 + b.month - (a.year * 100 + a.month));
        const row = mine[0];
        return Promise.resolve(row ? { year: row.year, month: row.month } : null);
      },
    },
    feeCharge: {
      findFirst: ({
        where,
      }: {
        where: { studentId: string; year: number; month: number; kind: string };
      }) =>
        Promise.resolve(
          charges.find(
            (c) =>
              c.studentId === where.studentId &&
              c.year === where.year &&
              c.month === where.month &&
              c.kind === where.kind,
          ) ?? null,
        ),
      create: ({ data }: { data: Omit<Charge, "kind"> }) => {
        created.push({ ...data, kind: "MONTHLY" });
        return Promise.resolve(data);
      },
    },
  } as unknown as Parameters<typeof ensureLiveMonthCharge>[0];
  return { tx, created };
}

const SEPTEMBER = [{ classId: "grade10", year: 2026, month: 9 }];

const student = {
  id: "std0044",
  classId: "grade10",
  monthlyFee: 16,
  feeBillingStartYear: null,
  feeBillingStartMonth: null,
};

describe("raising the live month for a student who became billable", () => {
  it("raises the class's set-up month when there is no charge for it", async () => {
    const { tx, created } = txWith({ activations: SEPTEMBER });
    await expect(ensureLiveMonthCharge(tx, "school", student)).resolves.toBe(true);
    expect(created).toEqual([
      {
        schoolId: "school",
        studentId: "std0044",
        year: 2026,
        month: 9,
        amount: 16,
        status: "UNPAID",
        kind: "MONTHLY",
      },
    ]);
  });

  it("leaves an existing charge alone, whatever its state", async () => {
    const { tx, created } = txWith({
      activations: SEPTEMBER,
      charges: [
        {
          studentId: "std0044",
          year: 2026,
          month: 9,
          kind: "MONTHLY",
          amount: 0,
          status: "PAID",
        },
      ],
    });
    await expect(ensureLiveMonthCharge(tx, "school", student)).resolves.toBe(
      false,
    );
    expect(created).toEqual([]);
  });

  it("raises nothing for a class the school has never set up", async () => {
    // Billing never starts on its own. Inventing a charge for a month the
    // school did not run would be worse than missing one.
    const { tx, created } = txWith({ activations: [] });
    await expect(ensureLiveMonthCharge(tx, "school", student)).resolves.toBe(
      false,
    );
    expect(created).toEqual([]);
  });

  it("raises nothing for a student with no fee", async () => {
    const { tx, created } = txWith({ activations: SEPTEMBER });
    await expect(
      ensureLiveMonthCharge(tx, "school", { ...student, monthlyFee: 0 }),
    ).resolves.toBe(false);
    expect(created).toEqual([]);
  });

  it("respects a billing start still ahead of the set-up month", async () => {
    const { tx, created } = txWith({ activations: SEPTEMBER });
    await expect(
      ensureLiveMonthCharge(tx, "school", {
        ...student,
        feeBillingStartYear: 2026,
        feeBillingStartMonth: 10,
      }),
    ).resolves.toBe(false);
    expect(created).toEqual([]);
  });

  it("bills a start month that has already arrived", async () => {
    const { tx, created } = txWith({ activations: SEPTEMBER });
    await expect(
      ensureLiveMonthCharge(tx, "school", {
        ...student,
        feeBillingStartYear: 2026,
        feeBillingStartMonth: 9,
      }),
    ).resolves.toBe(true);
    expect(created).toHaveLength(1);
  });

  it("takes the class's own newest month, not the school's", async () => {
    // Grade 6 still on September while the seniors are on October: billing the
    // senior month would raise a charge for a month Grade 6 never ran.
    const { tx, created } = txWith({
      activations: [
        { classId: "grade6", year: 2026, month: 9 },
        { classId: "grade11", year: 2026, month: 10 },
      ],
    });
    await ensureLiveMonthCharge(tx, "school", {
      ...student,
      classId: "grade6",
    });
    expect(created[0]).toMatchObject({ year: 2026, month: 9 });
  });

  it("raises nothing for a student in no class", async () => {
    const { tx, created } = txWith({ activations: SEPTEMBER });
    await expect(
      ensureLiveMonthCharge(tx, "school", { ...student, classId: null }),
    ).resolves.toBe(false);
    expect(created).toEqual([]);
  });
});
