import {
  smsAccountNo,
  smsSendBlock,
  type SmsSendState,
} from "./sms-send-gate";

const open: SmsSendState = {
  suspended: false,
  suspendedReason: null,
  enabled: true,
  dailyLimit: 0,
  monthlyLimit: 0,
  sentToday: 0,
  sentThisMonth: 0,
  wanted: 1,
};

describe("smsSendBlock", () => {
  it("lets an ordinary school send", () => {
    expect(smsSendBlock(open)).toBeNull();
  });

  it("refuses a suspended school even with its own switch on", () => {
    // The whole point of a platform suspension: the school owns `enabled` and
    // must not be able to undo the owner's decision with it.
    const msg = smsSendBlock({ ...open, suspended: true, enabled: true });
    expect(msg).toMatch(/suspended/i);
  });

  it("names the reason the owner gave", () => {
    const msg = smsSendBlock({
      ...open,
      suspended: true,
      suspendedReason: "  Account configuration issue  ",
    });
    expect(msg).toContain("Account configuration issue");
  });

  it("falls back to a plain message when no reason was given", () => {
    expect(smsSendBlock({ ...open, suspended: true, suspendedReason: "   " }))
      .toBe("SMS is suspended for this school. Contact your administrator.");
  });

  it("reports suspension before the school's own switch", () => {
    const msg = smsSendBlock({ ...open, suspended: true, enabled: false });
    expect(msg).toMatch(/suspended/i);
  });

  it("refuses when the school has switched SMS off", () => {
    expect(smsSendBlock({ ...open, enabled: false })).toBe(
      "SMS is disabled for this school.",
    );
  });

  it("treats a limit of zero as no limit at all", () => {
    // Every school carries 0 until the owner sets a number; reading that as a
    // ceiling of zero would have stopped all 78 of them sending.
    expect(
      smsSendBlock({ ...open, dailyLimit: 0, sentToday: 9999, wanted: 500 }),
    ).toBeNull();
  });

  it("refuses a send that would cross the daily limit", () => {
    const msg = smsSendBlock({
      ...open,
      dailyLimit: 100,
      sentToday: 98,
      wanted: 5,
    });
    expect(msg).toMatch(/limit reached/i);
    expect(msg).toContain("100");
  });

  it("allows a send that lands exactly on the limit", () => {
    expect(
      smsSendBlock({ ...open, dailyLimit: 100, sentToday: 95, wanted: 5 }),
    ).toBeNull();
  });

  it("refuses a send that would cross the monthly limit", () => {
    const msg = smsSendBlock({
      ...open,
      monthlyLimit: 1000,
      sentThisMonth: 999,
      wanted: 2,
    });
    expect(msg).toMatch(/Monthly limit 1000/);
  });

  it("checks the daily limit before the monthly one", () => {
    const msg = smsSendBlock({
      ...open,
      dailyLimit: 10,
      monthlyLimit: 20,
      sentToday: 10,
      sentThisMonth: 20,
      wanted: 1,
    });
    expect(msg).toMatch(/Daily limit 10/);
  });
});

describe("smsAccountNo", () => {
  it("is stable for the same school", () => {
    const id = "clx9f2k4b0000qwer1234tyui";
    expect(smsAccountNo(id)).toBe(smsAccountNo(id));
  });

  it("differs between schools", () => {
    expect(smsAccountNo("clx9f2k4b0000qwer1234tyui")).not.toBe(
      smsAccountNo("clx9f2k4b0000qwer1234asdf"),
    );
  });

  it("reads as an account number", () => {
    expect(smsAccountNo("clx9f2k4b0000qwer1234tyui")).toMatch(
      /^SMS-ACC-[0-9A-Z]{8}$/,
    );
  });

  it("pads a short id rather than producing a ragged number", () => {
    expect(smsAccountNo("ab-c")).toBe("SMS-ACC-00000ABC");
  });
});
