import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The rules an exam-result send has to keep, checked where they are written.
 *
 * These are the ones that cannot be undone if they are wrong. An SMS to four
 * hundred parents is not recallable, so the gates around it — published only,
 * previewed first, one result per parent — are worth pinning in place rather
 * than leaving to whoever edits the service next.
 */
const service = readFileSync(
  join(__dirname, "exam-result-sms.service.ts"),
  "utf8",
);
const controller = readFileSync(
  join(__dirname, "exam-result-sms.controller.ts"),
  "utf8",
);

describe("nothing goes out for an unpublished result", () => {
  it("refuses any status but PUBLISHED", () => {
    expect(service).toContain('examRow.status !== "PUBLISHED"');
    expect(service).toContain("Result not published");
  });

  it("checks it before any message is built", () => {
    // Before the template, before the marks, before the parents: a school
    // should be told why in one step, not after the work.
    const prepare = service.slice(service.indexOf("private async prepare("));
    expect(prepare.indexOf('!== "PUBLISHED"')).toBeLessThan(
      prepare.indexOf("this.resolveTemplate("),
    );
  });
});

describe("preview and send are the same arithmetic", () => {
  it("both go through one prepare()", () => {
    expect(service).toMatch(/async preview\([\s\S]{0,200}this\.prepare\(/);
    expect(service).toMatch(/async send\([\s\S]{0,300}this\.prepare\(/);
  });

  it("the preview costs the batch in the unit the school is billed in", () => {
    expect(service).toContain("segments: estimateSmsCredits(body)");
    expect(service).toContain("reduce((n, r) => n + r.segments, 0)");
    expect(service).toContain("shortfall: Math.max(0, credits - balance)");
  });

  it("says who is being left out, and why", () => {
    for (const reason of ["NO_PHONE", "NO_MARKS", "ALREADY_SENT"]) {
      expect(service).toContain(`"${reason}"`);
    }
  });
});

describe("the parent to text", () => {
  it("takes the parent's own number first, then the alternate", () => {
    expect(service).toContain(
      "r.parent?.phone?.trim() || r.parent?.altPhone?.trim()",
    );
  });

  it("reports a student with no number rather than dropping them", () => {
    // A silent omission is not something a school can fix.
    expect(service).toContain('!parent?.phone\n');
  });
});

describe("one result, one parent, once", () => {
  it("matches a previous send on the student and the exam", () => {
    expect(service).toContain('category: "EXAM_RESULT"');
    expect(service).toContain("recipientRefId: { in: studentIds }");
    expect(service).toContain("providerRefId: examId");
  });

  it("does not count a failed message as already sent", () => {
    expect(service).toContain('status: { not: "FAILED" }');
  });

  it("only resends when the school says so", () => {
    expect(service).toContain('opts.resend && r.skip === "ALREADY_SENT"');
    expect(controller).toContain("resend: z.boolean().optional()");
  });

  it("tags the batch with the exam so the next send can tell", () => {
    expect(service).toContain("providerRefId: opts.examId");
  });
});

describe("who may do it", () => {
  it("lets any staff account preview, on the SMS permission", () => {
    expect(controller).toContain('@RequirePermission("sms.view")');
  });

  it("narrows sending to the roles that own results and messaging", () => {
    expect(controller).toContain(
      "@Roles(UserRole.ADMINISTRATOR, UserRole.EXAM_MANAGER)",
    );
    expect(controller).toContain('@RequirePermission("sms.create")');
  });
});

describe("the result is the school's own, not a second opinion", () => {
  it("reads the result sheet rather than recomputing marks", () => {
    // The grade ladder, the pass mark and the totals all live in one place.
    // A parent told 87.7% and an office shown 88% is the failure this avoids.
    expect(service).toContain("this.exams.classResultsMatrix(");
    expect(service).not.toContain("gradeFromBands(");
  });

  it("places a student over the whole sheet, not the selection", () => {
    expect(service).toMatch(
      /positions\(\s*matrix\.rows\.map/,
    );
  });
});
