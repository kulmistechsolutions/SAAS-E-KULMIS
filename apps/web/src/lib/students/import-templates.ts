import type { StudentFormTemplate } from "@/lib/settings/types";
import type { ImportRow } from "@/lib/students/store";

/**
 * One Excel/CSV import layout per registration form template.
 *
 * Columns are matched by POSITION (see `csvToObjects`), so `columns` and
 * `headers` must stay index-for-index aligned. `headers` is also what the
 * uploaded file is checked against by name, so a school that reorders or
 * renames a column gets a clear error instead of silently shifted data.
 */
export interface ImportTemplate {
  headers: string[];
  columns: (keyof ImportRow)[];
  /** Header row + two example rows, offered as the downloadable starter file. */
  sample: string;
  filename: string;
}

/**
 * The layout every school has always used. Village is last and optional, so a
 * file saved before that column existed still parses correctly.
 */
const STANDARD: ImportTemplate = {
  headers: [
    "Student Name",
    "Gender",
    "Parent Name",
    "Parent Phone",
    "Class",
    "Section",
    "Monthly Fee",
    "Village",
  ],
  columns: [
    "fullName",
    "gender",
    "parentName",
    "parentPhone",
    "className",
    "section",
    "monthlyFee",
    "village",
  ],
  sample: [
    "Student Name,Gender,Parent Name,Parent Phone,Class,Section,Monthly Fee,Village",
    "Amina Hassan,FEMALE,Mohamed Hassan,+252611000001,Grade 5,A,60,",
    "Yusuf Ali,MALE,Fadumo Ali,+252611000002,Grade 3,B,50,",
  ].join("\n"),
  filename: "students-template.csv",
};

/**
 * The traditional admission-register layout. The first ten columns are the
 * school's own sheet, in their order — S/N included so the file can be filled
 * in exactly as the paper register reads (it is ignored on import; the system
 * still allocates the Student ID).
 *
 * Gender, Class, Section and Monthly Fee follow. They are not on the paper
 * register, but the ERP genuinely needs them: gender drives the student
 * reports, certificates and result cards, and class/section/fee are what the
 * registration itself is filed against. Defaulting them would write data the
 * school never supplied, so they are asked for rather than guessed.
 */
const TRADITIONAL: ImportTemplate = {
  headers: [
    "S/N",
    "Name",
    "Date of Birth",
    "Place of Birth",
    "Mobile",
    "District",
    "Village",
    "Mother Name",
    "Guardian Name",
    "Guardian Mobile",
    "Gender",
    "Class",
    "Section",
    "Monthly Fee",
  ],
  columns: [
    "serial",
    "fullName",
    "dob",
    "placeOfBirth",
    "phone",
    "district",
    "village",
    "motherName",
    "parentName",
    "parentPhone",
    "gender",
    "className",
    "section",
    "monthlyFee",
  ],
  sample: [
    "S/N,Name,Date of Birth,Place of Birth,Mobile,District,Village,Mother Name,Guardian Name,Guardian Mobile,Gender,Class,Section,Monthly Fee",
    "1,Amina Hassan,2015-04-02,Baidoa,,Berdaale,,Faadumo Cali,Mohamed Hassan,+252611000001,FEMALE,Grade 5,A,60",
    "2,Yusuf Ali,2016-09-18,Mogadishu,,Hodan,,Xaawo Nuur,Fadumo Ali,+252611000002,MALE,Grade 3,B,50",
  ].join("\n"),
  filename: "students-template-traditional.csv",
};

/** The import layout that matches a school's active registration form. */
export function importTemplateFor(
  template: StudentFormTemplate,
): ImportTemplate {
  return template === "DETAILED" ? TRADITIONAL : STANDARD;
}

/** Triggers a browser download of a template's starter file. */
export function downloadImportTemplate(template: StudentFormTemplate): void {
  const { sample, filename } = importTemplateFor(template);
  const blob = new Blob([sample], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
