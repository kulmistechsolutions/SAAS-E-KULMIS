import { registerStudentSchema, updateStudentSchema } from "@ekulmis/shared";

/**
 * A mistyped birth year is refused with a sentence.
 *
 * Both failures happened in production: "20114" crashed a registration at
 * siraaji with an error the desk could not read, and "0013" was accepted,
 * leaving a child born in year 13 on the register.
 */
const base = {
  fullName: "Test Child",
  gender: "MALE",
  parentName: "Parent",
  parentPhone: "0610000000",
  classId: "c1",
};

describe("date of birth", () => {
  it("accepts a real one", () => {
    expect(registerStudentSchema.safeParse({ ...base, dob: "2014-02-05" }).success).toBe(true);
  });

  it("refuses a year with a slipped key", () => {
    for (const dob of ["20114-02-05", "0013-02-02", "0987-01-11", "2201-02-01"]) {
      const r = registerStudentSchema.safeParse({ ...base, dob });
      expect(r.success).toBe(false);
    }
  });

  it("says what is wrong", () => {
    const r = registerStudentSchema.safeParse({ ...base, dob: "0013-02-02" });
    expect(JSON.stringify(r.error?.flatten())).toContain("check the year");
  });

  it("refuses a birth in the future", () => {
    const next = new Date(Date.now() + 40 * 24 * 3600 * 1000).toISOString().slice(0, 10);
    expect(registerStudentSchema.safeParse({ ...base, dob: next }).success).toBe(false);
  });

  it("still lets the date be left out", () => {
    expect(registerStudentSchema.safeParse({ ...base }).success).toBe(true);
    expect(registerStudentSchema.safeParse({ ...base, dob: null }).success).toBe(true);
  });

  it("applies when a student is edited too", () => {
    expect(updateStudentSchema.safeParse({ dob: "0013-02-02" }).success).toBe(false);
    expect(updateStudentSchema.safeParse({ dob: "2013-02-02" }).success).toBe(true);
  });
});
