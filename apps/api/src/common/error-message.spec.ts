import { messageFromErrorBody } from "@ekulmis/shared";

/**
 * A school registering a teacher with a salary of 3.5 was told "Bad Request".
 * The server had said exactly what was wrong; the client only read `message`.
 */
describe("what a person is told when the server refuses a form", () => {
  it("says which box and why, for a decimal salary", () => {
    const body = { formErrors: [], fieldErrors: { salary: ["Expected integer, received float"] } };
    expect(messageFromErrorBody(body, "Bad Request")).toBe(
      "Salary must be a whole number, with no decimals.",
    );
  });

  it("names several problems at once, with the field names a person uses", () => {
    const body = {
      formErrors: [],
      fieldErrors: { fullName: ["Required"], monthlyFee: ["Expected number, received nan"] },
    };
    expect(messageFromErrorBody(body, "x")).toBe(
      "Full name is required. Monthly fee must be a number.",
    );
  });

  it("keeps a message that is already a sentence as it is", () => {
    const body = { fieldErrors: { shifts: ["Select at least one shift"] } };
    expect(messageFromErrorBody(body, "x")).toBe("Select at least one shift.");
  });

  it("still uses an ordinary message first, string or list", () => {
    expect(messageFromErrorBody({ message: "Maximum teacher limit reached." }, "x")).toBe(
      "Maximum teacher limit reached.",
    );
    expect(messageFromErrorBody({ message: ["a", "b"] }, "x")).toBe("a, b");
  });

  it("falls back when there is nothing to say", () => {
    expect(messageFromErrorBody({}, "Bad Request")).toBe("Bad Request");
    expect(messageFromErrorBody(null, "Bad Request")).toBe("Bad Request");
  });
});
