import {
  registerStudentSchema,
  formatMoney,
  payFeeSchema,
  roundMoney,
} from "@ekulmis/shared";

describe("money with cents", () => {
  it("rounds sums to the cent", () => {
    expect(roundMoney(0.1 + 0.2)).toBe(0.3);
    expect(roundMoney(5.5 + 5.5 + 5.5)).toBe(16.5);
    expect(roundMoney(10.3 - 5.1)).toBe(5.2);
    expect(roundMoney(1.005)).toBe(1.01);
    expect(roundMoney(-2.675)).toBe(-2.68);
  });

  it("accepts a fee of $5.5 when registering a student, refuses fractions of a cent", () => {
    const base = registerStudentSchema.safeParse({ fullName: "Test", monthlyFee: 5.5 });
    const monthlyFeeIssues = (r: typeof base) =>
      r.success ? [] : r.error.issues.filter((i: { path: (string | number)[] }) => i.path[0] === "monthlyFee");
    expect(monthlyFeeIssues(base)).toEqual([]);
    expect(monthlyFeeIssues(registerStudentSchema.safeParse({ fullName: "Test", monthlyFee: 12.25 }))).toEqual([]);
    expect(monthlyFeeIssues(registerStudentSchema.safeParse({ fullName: "Test", monthlyFee: 5.555 }))).not.toEqual([]);
    expect(monthlyFeeIssues(registerStudentSchema.safeParse({ fullName: "Test", monthlyFee: -1 }))).not.toEqual([]);
  });

  it("accepts a payment of $5.50", () => {
    const r = payFeeSchema.safeParse({ studentId: "s1", amount: 5.5, type: "THIS_MONTH" });
    const amountIssues = r.success ? [] : r.error.issues.filter((i: { path: (string | number)[] }) => i.path[0] === "amount");
    expect(amountIssues).toEqual([]);
  });

  it("prints the cents instead of rounding them away", () => {
    expect(formatMoney(5.5, "USD", { decimals: 0 })).toContain("5.50");
    expect(formatMoney(5, "USD", { decimals: 0 })).not.toContain(".");
    expect(formatMoney(0.1 + 0.2, "USD", { decimals: 0 })).toContain("0.30");
  });
});
