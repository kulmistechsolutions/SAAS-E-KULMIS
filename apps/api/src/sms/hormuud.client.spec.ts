import {
  explainSendFailure,
  isSendAccepted,
  realMessageId,
} from "./hormuud.client";

describe("explainSendFailure", () => {
  it("explains 203 instead of repeating \"Failed.\"", () => {
    expect(explainSendFailure("203", "Failed.", 200)).toContain(
      "sender name is not registered",
    );
  });

  it("keeps an unknown code's own message and shows the code", () => {
    expect(explainSendFailure("999", "Quota exceeded", 200)).toBe(
      "Quota exceeded (code 999)",
    );
  });

  it("falls back to the HTTP status when the body says nothing", () => {
    expect(explainSendFailure("", "", 502)).toBe(
      "Hormuud send failed (HTTP 502)",
    );
  });
});

describe("realMessageId", () => {
  it("keeps a genuine provider id", () => {
    expect(realMessageId("1078e62a-4c11-4f0e-9a7b-33d0f4b1c2ee")).toBe(
      "1078e62a-4c11-4f0e-9a7b-33d0f4b1c2ee",
    );
  });

  it("rejects the literal string \"null\" Hormuud sends for refused messages", () => {
    expect(realMessageId("null")).toBeUndefined();
    expect(realMessageId("NULL")).toBeUndefined();
    expect(realMessageId(" null ")).toBeUndefined();
  });

  it("rejects the other empty placeholders", () => {
    expect(realMessageId("")).toBeUndefined();
    expect(realMessageId("   ")).toBeUndefined();
    expect(realMessageId("undefined")).toBeUndefined();
    expect(realMessageId("0")).toBeUndefined();
    expect(realMessageId(undefined)).toBeUndefined();
  });
});

describe("isSendAccepted", () => {
  it("accepts a 200 with a real id", () => {
    expect(
      isSendAccepted({
        httpOk: true,
        responseCode: "200",
        messageId: "0e8dd583-aa",
      }),
    ).toBe(true);
  });

  it("accepts the alternative success codes", () => {
    expect(isSendAccepted({ httpOk: true, responseCode: "0" })).toBe(true);
    expect(isSendAccepted({ httpOk: true, responseCode: "Success" })).toBe(true);
  });

  // The bug this file exists for: Hormuud refused the message with code 203
  // and MessageID "null", the truthiness check read that as an id, and the
  // school was shown "Sent" for a message no parent ever received.
  it("refuses code 203 even though MessageID is the string \"null\"", () => {
    expect(
      isSendAccepted({
        httpOk: true,
        responseCode: "203",
        messageId: "null",
      }),
    ).toBe(false);
  });

  it("lets a stated failure code override any message id", () => {
    expect(
      isSendAccepted({
        httpOk: true,
        responseCode: "203",
        messageId: "looks-real-but-was-refused",
      }),
    ).toBe(false);
  });

  it("falls back to the message id only when no code is stated", () => {
    expect(
      isSendAccepted({ httpOk: true, responseCode: "", messageId: "abc123" }),
    ).toBe(true);
    expect(
      isSendAccepted({ httpOk: true, responseCode: "", messageId: "null" }),
    ).toBe(false);
    expect(isSendAccepted({ httpOk: true, responseCode: "" })).toBe(false);
  });

  it("refuses anything that failed at the HTTP layer", () => {
    expect(
      isSendAccepted({
        httpOk: false,
        responseCode: "200",
        messageId: "abc123",
      }),
    ).toBe(false);
  });
});
