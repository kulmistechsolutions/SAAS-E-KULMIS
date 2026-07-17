"use client";

import type { RefObject } from "react";

/**
 * The variables the SMS renderer fills in automatically. Mirrors ALIASES in
 * apps/api/src/sms/sms-template.util.ts — the tokens here are the Somali
 * spellings, matching the built-in Somali templates.
 */
export const SMS_VARIABLES: { token: string; label: string }[] = [
  { token: "Magaca Waalidka", label: "Parent name" },
  { token: "Magaca Ardayga", label: "Student name" },
  { token: "Magaca Dugsiga", label: "School name" },
  { token: "Fasalka", label: "Class" },
  { token: "Qaybta", label: "Section" },
  { token: "Lacagta Hadhay", label: "Outstanding balance" },
  { token: "Lacagta", label: "Amount paid" },
  { token: "Lambarka Rasiidhka", label: "Receipt number" },
  { token: "Lambarka Ardayga", label: "Student ID" },
  { token: "Imtixaanka", label: "Exam name" },
  { token: "Dhibcaha", label: "Marks" },
  { token: "Taariikhda", label: "Date" },
  { token: "Sanad Dugsiyeedka", label: "Academic year" },
];

/**
 * Every spelling the backend substitutes (English + Somali), lowercased.
 * Kept in sync with ALIASES in apps/api/src/sms/sms-template.util.ts.
 */
const KNOWN_TOKENS = new Set(
  [
    "Student Name", "student_name", "studentName", "StudentName", "Magaca Ardayga",
    "Parent Name", "parent_name", "parentName", "ParentName", "Magaca Waalidka",
    "School Name", "school_name", "schoolName", "SchoolName", "Magaca Dugsiga",
    "Class", "className", "Class Name", "Fasalka",
    "Section", "Qaybta",
    "Outstanding Balance", "Balance", "outstanding", "outstandingBalance",
    "Lacagta Hadhaysa", "Lacagta Hadhay", "Deynta",
    "Due Date", "dueDate", "DueDate", "Taariikhda Ugu Dambeysa",
    "Academic Year", "academicYear", "AcademicYear", "Year", "Sanad Dugsiyeedka",
    "Amount", "Paid Amount", "Lacagta",
    "Receipt Number", "receiptNumber", "Receipt", "Lambarka Rasiidhka",
    "Student ID", "studentCode", "Student Code", "Lambarka Ardayga",
    "Exam Name", "examName", "Exam", "Imtixaanka",
    "Marks", "Score", "Dhibcaha",
    "Date", "Taariikhda",
  ].map((t) => t.toLowerCase()),
);

/**
 * Placeholders in the body that the system will NOT fill in — either a typo
 * (e.g. {{Magaca Waalid}}) or a fill-in-yourself slot in a built-in template
 * (e.g. {{Farriinta}} in the emergency notice). Both send as blank text, so
 * the UI warns about them before the message goes out.
 */
export function unknownVariables(body: string): string[] {
  const found = new Set<string>();
  for (const m of body.matchAll(/\{\{\s*([^}]+?)\s*\}\}/g)) {
    const token = m[1]!.trim();
    if (!KNOWN_TOKENS.has(token.toLowerCase())) found.add(token);
  }
  return [...found];
}

interface Props {
  /** The textarea the token is inserted into, at the caret. */
  targetRef: RefObject<HTMLTextAreaElement | null>;
  value: string;
  onChange: (next: string) => void;
}

/**
 * Click-to-insert variable chips. Schools should never have to type a
 * {{token}} by hand — a misspelled one silently renders as blank text.
 */
export function VariablePicker({ targetRef, value, onChange }: Props) {
  function insert(token: string) {
    const text = `{{${token}}}`;
    const el = targetRef.current;
    if (!el) {
      onChange(value + text);
      return;
    }
    const start = el.selectionStart ?? value.length;
    const end = el.selectionEnd ?? value.length;
    onChange(value.slice(0, start) + text + value.slice(end));
    // Put the caret straight after the inserted token so typing continues
    // where the user expects, instead of jumping to the end.
    requestAnimationFrame(() => {
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  }

  return (
    <div className="rounded-lg border bg-secondary/40 p-2">
      <p className="mb-1.5 px-0.5 text-[11px] font-medium text-muted-foreground">
        Click to insert — these fill in automatically for each recipient
      </p>
      <div className="flex flex-wrap gap-1">
        {SMS_VARIABLES.map((v) => (
          <button
            key={v.token}
            type="button"
            title={v.label}
            onClick={() => insert(v.token)}
            className="rounded-md border bg-background px-2 py-1 text-[11px] font-medium text-foreground transition-colors hover:border-primary hover:bg-primary/10 hover:text-primary"
          >
            {v.token}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Warning strip listing placeholders that will send as blank text. */
export function VariableWarning({ body }: { body: string }) {
  const unknown = unknownVariables(body);
  if (unknown.length === 0) return null;
  return (
    <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">
      Will send blank — replace with real text:{" "}
      {unknown.map((u) => `{{${u}}}`).join(", ")}
    </p>
  );
}
