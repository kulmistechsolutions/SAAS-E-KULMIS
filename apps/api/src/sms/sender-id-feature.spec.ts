import {
  resolveSendingName,
  senderIdFeatureEnabled,
} from "./sender-id-feature";

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

describe("resolveSendingName", () => {
  const school = { name: "KULMIS TECH SCHOOL", smsSenderName: "KULMIS TECH" };

  it("ignores the school's own name while the feature is off", () => {
    expect(resolveSendingName(school, null, {})).toBe("KULMIS TECH SCHOOL");
  });

  it("uses it once the feature is on", () => {
    expect(
      resolveSendingName(school, null, { SMS_SENDER_ID_ENABLED: "true" }),
    ).toBe("KULMIS TECH");
  });

  it("lets a configured gateway name win over the school name", () => {
    expect(resolveSendingName(school, "REGISTERED", {})).toBe("REGISTERED");
  });

  it("truncates to what the provider accepts on the wire", () => {
    expect(
      resolveSendingName({ name: "DUGSIGA HOOSE DHEXE SARE EE NUURUL HIDAYA" }, null, {}),
    ).toBe("DUGSIGA HOOSE DHEXE ");
  });

  it("never resolves to nothing", () => {
    expect(resolveSendingName({ name: "" }, null, {})).toBe("eKulmis");
  });
});
