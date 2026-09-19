import {
  buildResultVars,
  ordinal,
  ordinalSo,
  positions,
  subjectLines,
  type ResultContext,
  type StudentResult,
} from "./exam-result-vars";
import { renderSmsTemplate } from "./sms-template.util";

const SUBJECTS = [
  { code: "SO", name: "Somali", mark: 90 },
  { code: "PH", name: "Physics", mark: 88 },
  { code: "MA", name: "Maths", mark: 85 },
];

function result(over: Partial<StudentResult> = {}): StudentResult {
  return {
    studentId: "s1",
    studentName: "Abdi Ali",
    studentCode: "STD0001",
    className: "Grade 8",
    sectionName: "A",
    subjects: SUBJECTS,
    totalObtained: 263,
    totalMax: 300,
    average: 87.7,
    grade: "B",
    passed: true,
    ...over,
  };
}

function ctx(over: Partial<ResultContext> = {}): ResultContext {
  return {
    examName: "Second Term Examination",
    term: "Term 2",
    academicYear: "2026/2027",
    schoolName: "Hanuuniye School",
    schoolPhone: "061xxxxxxx",
    schoolAddress: "Muqdisho",
    parentName: "Ahmed Hassan",
    parentPhone: "0612345678",
    position: 2,
    positionOf: 32,
    sectionPosition: 1,
    sectionPositionOf: 16,
    passLabel: "PASS",
    failLabel: "FAIL",
    ...over,
  };
}

describe("where a student placed", () => {
  it("ranks by total, highest first", () => {
    const p = positions([
      { studentId: "a", totalObtained: 200, marked: true },
      { studentId: "b", totalObtained: 263, marked: true },
      { studentId: "c", totalObtained: 240, marked: true },
    ]);
    expect(p.get("b")!.position).toBe(1);
    expect(p.get("c")!.position).toBe(2);
    expect(p.get("a")!.position).toBe(3);
  });

  it("gives a tie the same place and skips the next", () => {
    // Joint second means the next child is fourth. Telling that parent
    // "third" is wrong in the only way that matters to them.
    const p = positions([
      { studentId: "a", totalObtained: 300, marked: true },
      { studentId: "b", totalObtained: 250, marked: true },
      { studentId: "c", totalObtained: 250, marked: true },
      { studentId: "d", totalObtained: 200, marked: true },
    ]);
    expect(p.get("a")!.position).toBe(1);
    expect(p.get("b")!.position).toBe(2);
    expect(p.get("c")!.position).toBe(2);
    expect(p.get("d")!.position).toBe(4);
  });

  it("does not place a student nobody has marked", () => {
    // They did not come last; they have no result. A parent told
    // "Position: 32" about an unmarked exam has been told something false.
    const p = positions([
      { studentId: "a", totalObtained: 263, marked: true },
      { studentId: "b", totalObtained: 0, marked: false },
    ]);
    expect(p.has("b")).toBe(false);
    expect(p.get("a")!.outOf).toBe(1);
  });

  it("counts the place out of those who sat it", () => {
    const p = positions([
      { studentId: "a", totalObtained: 3, marked: true },
      { studentId: "b", totalObtained: 2, marked: true },
      { studentId: "c", totalObtained: 0, marked: false },
    ]);
    expect(p.get("a")!.outOf).toBe(2);
  });
});

describe("writing a place out", () => {
  it("in English", () => {
    expect([1, 2, 3, 4, 11, 12, 13, 21, 102].map(ordinal)).toEqual([
      "1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "102nd",
    ]);
  });

  it("in Somali", () => {
    expect([1, 2, 3, 10].map(ordinalSo)).toEqual([
      "1aad", "2aad", "3aad", "10aad",
    ]);
  });
});

describe("the subject block", () => {
  it("uses the code, not the name", () => {
    // An SMS is charged by the character: "Somali: 90" over "SO: 90" is four
    // characters a subject, and six subjects of that is a second segment for
    // every parent.
    expect(subjectLines(SUBJECTS)).toBe("SO: 90\nPH: 88\nMA: 85");
  });

  it("takes only the subjects a school picked, in its order", () => {
    expect(subjectLines(SUBJECTS, { only: ["MA", "SO"] })).toBe(
      "MA: 85\nSO: 90",
    );
  });

  it("says so when a subject was never marked", () => {
    expect(
      subjectLines([{ code: "EN", name: "English", mark: null }]),
    ).toBe("EN: -");
  });

  it("lets a school lay it out to save characters", () => {
    expect(subjectLines(SUBJECTS, { separator: " ", joiner: " " })).toBe(
      "SO 90 PH 88 MA 85",
    );
  });
});

describe("the values a template can name", () => {
  const vars = buildResultVars(result(), ctx());

  it("carries the student, the exam and the school", () => {
    expect(vars.student_name).toBe("Abdi Ali");
    expect(vars.student_id).toBe("STD0001");
    expect(vars.class_name).toBe("Grade 8");
    expect(vars.exam_name).toBe("Second Term Examination");
    expect(vars.academic_year).toBe("2026/2027");
    expect(vars.school_name).toBe("Hanuuniye School");
  });

  it("carries the figures a parent is being told", () => {
    expect(vars.total).toBe("263");
    expect(vars.total_out_of).toBe("263/300");
    expect(vars.average).toBe("87.7");
    expect(vars.percentage).toBe("87.7%");
    expect(vars.grade).toBe("B");
    expect(vars.result_status).toBe("PASS");
  });

  it("offers the place in either language", () => {
    expect(vars.position).toBe("2");
    expect(vars.position_ordinal).toBe("2nd");
    expect(vars.position_so).toBe("2aad");
    expect(vars.position_of).toBe("2/32");
  });

  it("leaves the place blank when there is none", () => {
    const v = buildResultVars(result(), ctx({ position: 0 }));
    expect(v.position).toBe("");
    expect(v.position_ordinal).toBe("");
  });

  it("addresses each subject by its own code", () => {
    expect(vars.SO).toBe("90");
    expect(vars.MA).toBe("85");
    expect(vars.Somali).toBe("90");
  });

  it("uses the school's own words for pass and fail", () => {
    const v = buildResultVars(
      result({ passed: false }),
      ctx({ failLabel: "DIB U QAAD" }),
    );
    expect(v.result_status).toBe("DIB U QAAD");
  });
});

describe("the template every school already has", () => {
  it("renders the built-in Somali exam-result message", () => {
    // Shipped with every school, written in the double-brace Somali tokens.
    // With only the handbook's snake_case names present it rendered as
    // "Salaan ,  wuxuu ku dhacay  imtixaanka ." — a blank message to every
    // parent, with nothing having failed. The preview caught it; nothing was
    // sent. Both spellings are emitted now.
    const body =
      "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} wuxuu ku dhacay " +
      "{{Dhibcaha}} imtixaanka {{Imtixaanka}}. Guul! - {{Magaca Dugsiga}}";
    expect(renderSmsTemplate(body, buildResultVars(result(), ctx()))).toBe(
      "Salaan Ahmed Hassan, Abdi Ali wuxuu ku dhacay 87.7% imtixaanka " +
        "Second Term Examination. Guul! - Hanuuniye School",
    );
  });

  it("answers to the camelCase names the alias table is built on", () => {
    const v = buildResultVars(result(), ctx());
    expect(v.studentName).toBe("Abdi Ali");
    expect(v.parentName).toBe("Ahmed Hassan");
    expect(v.schoolName).toBe("Hanuuniye School");
    expect(v.className).toBe("Grade 8");
    expect(v.examName).toBe("Second Term Examination");
    expect(v.studentCode).toBe("STD0001");
    expect(v.academicYear).toBe("2026/2027");
    expect(v.marks).toBe("87.7%");
  });

  it("still answers to the handbook's names", () => {
    const v = buildResultVars(result(), ctx());
    expect(v.student_name).toBe("Abdi Ali");
    expect(v.school_name).toBe("Hanuuniye School");
  });
});

describe("a whole message, end to end", () => {
  it("renders the handbook's Somali template", () => {
    const body = [
      "Waalid/Masuul,",
      "Ardayga: {student_name}",
      "Imtixaan: {exam_name}",
      "Fasalka: {class_name}",
      "{subjects}",
      "Celcelis: {percentage}",
      "Darajo: {position_so}",
      "Natiijo: {result_status}",
      "Mahadsanid. {school_name}",
    ].join("\n");

    expect(renderSmsTemplate(body, buildResultVars(result(), ctx()))).toBe(
      [
        "Waalid/Masuul,",
        "Ardayga: Abdi Ali",
        "Imtixaan: Second Term Examination",
        "Fasalka: Grade 8",
        "SO: 90",
        "PH: 88",
        "MA: 85",
        "Celcelis: 87.7%",
        "Darajo: 2aad",
        "Natiijo: PASS",
        "Mahadsanid. Hanuuniye School",
      ].join("\n"),
    );
  });

  it("renders subjects placed by hand", () => {
    expect(
      renderSmsTemplate("SO {SO} PH {PH} MA {MA}", buildResultVars(result(), ctx())),
    ).toBe("SO 90 PH 88 MA 85");
  });

  it("still renders the double braces every existing template uses", () => {
    expect(
      renderSmsTemplate("Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}}.", {
        parentName: "Ahmed Hassan",
        studentName: "Abdi Ali",
      }),
    ).toBe("Salaan Ahmed Hassan, Abdi Ali.");
  });

  it("blanks a name nobody fills, as it always has", () => {
    // {{Farriinta}} in the built-in emergency notice is a slot the sender
    // fills, not a variable. Leaving the braces standing would post them to
    // every parent.
    expect(renderSmsTemplate("X: {{Farriinta}}|{nothing}", {})).toBe("X: |");
  });
});
