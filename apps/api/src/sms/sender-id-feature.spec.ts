import { senderIdFeatureEnabled } from "./sender-id-feature";

describe("senderIdFeatureEnabled", () => {
  // Off by default: an approved name is not a registered one, and sends under
  // an unregistered name come back refused.
  it("is off when the variable is unset or empty", () => {
    expect(senderIdFeatureEnabled({})).toBe(false);
    expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: "" })).toBe(false);
    expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: "  " })).toBe(false);
  });

  it("is on only for an explicit true", () => {
    expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: "true" })).toBe(true);
    expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: "TRUE" })).toBe(true);
    expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: " true " })).toBe(
      true,
    );
  });

  it("stays off for anything else, including values that look affirmative", () => {
    for (const v of ["false", "1", "yes", "on", "enabled", "0"]) {
      expect(senderIdFeatureEnabled({ SMS_SENDER_ID_ENABLED: v })).toBe(false);
    }
  });
});
