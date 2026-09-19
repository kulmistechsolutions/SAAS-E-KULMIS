import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The send screen has to make the send an informed decision.
 *
 * Four hundred parents, one button, nothing recallable. So the screen offers
 * only exams that may be sent, shows the real message with a real child's
 * marks in it, costs the batch in credits against the balance, names everyone
 * it is leaving out, and asks once more before it goes.
 */
const WEB = join(__dirname, "..", "..", "..", "web", "src");
const page = readFileSync(
  join(WEB, "app", "(app)", "sms", "exam-results", "page.tsx"),
  "utf8",
);
const controller = readFileSync(
  join(__dirname, "exam-result-sms.controller.ts"),
  "utf8",
);
const service = readFileSync(
  join(__dirname, "exam-result-sms.service.ts"),
  "utf8",
);

describe("the screen offers only what can be sent", () => {
  it("lists published exams and nothing else", () => {
    expect(page).toContain('rows.filter((e) => e.status === "PUBLISHED")');
  });

  it("says so when a school has none", () => {
    expect(page).toContain("smsExamResults.noPublished");
  });
});

describe("nothing is sent unpreviewed", () => {
  it("has no path to send without a preview in hand", () => {
    // Every send reads preview.exam.id, so a preview must exist first.
    expect(page).toContain("if (!preview) return;");
    expect(page).toContain("examId: preview.exam.id");
  });

  it("shows each parent the message they will actually get", () => {
    expect(page).toContain("{r.body}");
    expect(page).toContain("{r.characters}");
    expect(page).toContain("{r.segments}");
  });
});

describe("what it costs, before it goes", () => {
  it("totals credits from the students still ticked", () => {
    expect(page).toContain(
      "const credits = chosen.reduce((n, r) => n + r.segments, 0);",
    );
    expect(page).toContain(
      "const shortfall = Math.max(0, credits - (preview?.summary.balance ?? 0));",
    );
  });

  it("refuses to send on a shortfall", () => {
    expect(page).toContain("disabled={chosen.length === 0 || shortfall > 0}");
    expect(page).toContain("smsExamResults.shortfall");
  });

  it("warns when the template costs two segments a parent", () => {
    expect(page).toContain("preview.summary.maxSegments > 1");
    expect(page).toContain("smsExamResults.twoSegments");
  });
});

describe("who is being left out, and why", () => {
  it("names each reason on the row", () => {
    // The key is built from the reason itself, so the wording has to exist
    // for every one of them or a row renders a blank badge.
    expect(page).toContain("`smsExamResults.skip${r.skip}`");
    const dict = readFileSync(
      join(WEB, "lib", "i18n", "dictionaries", "so-generated.ts"),
      "utf8",
    );
    for (const reason of ["NO_MARKS", "NO_PHONE", "ALREADY_SENT"]) {
      expect(dict).toContain(`skip${reason}:`);
    }
  });

  it("will not let a skipped student be ticked back on", () => {
    expect(page).toContain("disabled={r.skip !== null}");
  });
});

describe("a failed send is put right without paying twice", () => {
  it("offers a retry only when something failed", () => {
    expect(page).toContain("history && history.failed > 0");
    expect(page).toContain("smsExamResults.retryFailed");
  });

  it("retries only the failures", () => {
    expect(service).toContain('status: "FAILED"');
    expect(service).toContain("return this.send(schoolId, userId, { ...opts, examId, studentIds });");
    expect(controller).toContain('@Post("retry")');
  });
});

describe("it asks before it sends", () => {
  it("confirms with the count, the exam and the cost", () => {
    expect(page).toContain("smsExamResults.confirmBody");
    expect(page).toContain('.replace("{credits}", String(credits))');
  });

  it("says the thing that cannot be undone", () => {
    expect(page).toContain("smsExamResults.confirmNote");
  });
});
