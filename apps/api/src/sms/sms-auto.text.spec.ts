import { autoSmsBody } from "./sms-auto.text";

/**
 * These messages send themselves, so their length is a standing cost: a body
 * that runs past 160 characters doubles what the school pays for every one of
 * them, for as long as the setting is on. GSM-7 only, too — a single accented
 * character drops the limit to 70.
 */
const GSM7 = /^[A-Za-z0-9 \r\n@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ!"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\^{}\[~\]|€]*$/;

describe("autoSmsBody", () => {
  const long = {
    school: "SHAMSUL-MAARIF PRIMARY & SECONDARY SCHOOL",
    student: "Cabdiraxmaan saadam ibraahim cismaan",
    receiptNo: "RCP00087",
    amount: "$1500",
    outstanding: "$2400",
    code: "STD0224",
    date: "2026-09-11",
    exam: "First Term Examination",
  };

  it("fits one segment for a payment, even with long names", () => {
    expect(autoSmsBody("FEE_PAID", long).length).toBeLessThanOrEqual(160);
  });

  it("fits one segment for a registration", () => {
    expect(autoSmsBody("REGISTERED", long).length).toBeLessThanOrEqual(160);
  });

  it("fits one segment for an absence", () => {
    expect(autoSmsBody("ABSENT", long).length).toBeLessThanOrEqual(160);
  });

  it("fits one segment for a result", () => {
    expect(autoSmsBody("RESULT", long).length).toBeLessThanOrEqual(160);
  });

  it("uses only characters the cheap alphabet has", () => {
    // Written with plain ASCII on purpose: one curly quote would cut every
    // one of these messages to 70 characters.
    const plain = {
      school: "KTS SCHOOL",
      student: "Ali Yasin",
      receiptNo: "RCP00019",
      amount: "$40",
      outstanding: "$0",
      code: "STD0107",
      date: "2026-09-11",
      exam: "Midterm",
    };
    for (const e of ["FEE_PAID", "REGISTERED", "ABSENT", "RESULT"] as const) {
      expect(autoSmsBody(e, plain)).toMatch(GSM7);
    }
  });

  it("names the student in every message", () => {
    for (const e of ["FEE_PAID", "REGISTERED", "ABSENT", "RESULT"] as const) {
      // A parent with several children has to know which one this is about.
      expect(autoSmsBody(e, long)).toContain(long.student);
    }
  });

  it("names the school in every message", () => {
    for (const e of ["FEE_PAID", "REGISTERED", "ABSENT", "RESULT"] as const) {
      expect(autoSmsBody(e, long)).toContain(long.school);
    }
  });

  it("tells a payer the receipt and what is left", () => {
    const body = autoSmsBody("FEE_PAID", long);
    expect(body).toContain("RCP00087");
    expect(body).toContain("$1500");
    expect(body).toContain("$2400");
  });
});
