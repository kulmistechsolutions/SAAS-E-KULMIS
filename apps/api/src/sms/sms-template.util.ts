/** Render SMS templates: {{Student Name}}, {{Parent Name}}, etc. */
const ALIASES: Record<string, string[]> = {
  studentName: ["Student Name", "student_name", "studentName", "StudentName"],
  parentName: ["Parent Name", "parent_name", "parentName", "ParentName"],
  schoolName: ["School Name", "school_name", "schoolName", "SchoolName"],
  className: ["Class", "class", "className", "Class Name"],
  section: ["Section", "section"],
  outstandingBalance: [
    "Outstanding Balance",
    "Balance",
    "outstanding",
    "outstandingBalance",
  ],
  dueDate: ["Due Date", "dueDate", "DueDate"],
  academicYear: ["Academic Year", "academicYear", "AcademicYear", "Year"],
  amount: ["Amount", "amount", "Paid Amount"],
  receiptNumber: ["Receipt Number", "receiptNumber", "Receipt"],
  studentCode: ["Student ID", "studentCode", "Student Code"],
  examName: ["Exam Name", "examName", "Exam"],
  marks: ["Marks", "marks", "Score"],
  date: ["Date", "date"],
};

export function renderSmsTemplate(
  body: string,
  vars: Record<string, string | number | null | undefined>,
): string {
  const flat: Record<string, string> = {};
  for (const [key, value] of Object.entries(vars)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    flat[key] = str;
    flat[key.toLowerCase()] = str;
    const aliases = ALIASES[key];
    if (aliases) {
      for (const a of aliases) {
        flat[a] = str;
        flat[a.toLowerCase()] = str;
      }
    }
  }

  return body.replace(/\{\{\s*([^}]+?)\s*\}\}/g, (_, raw: string) => {
    const key = String(raw).trim();
    return flat[key] ?? flat[key.toLowerCase()] ?? "";
  });
}

export const DEFAULT_TEMPLATES: {
  name: string;
  category: string;
  body: string;
}[] = [
  {
    name: "Fee Reminder",
    category: "FEE_REMINDER",
    body: "Dear {{Parent Name}}, {{Student Name}} ({{Class}}) has an outstanding balance of {{Outstanding Balance}} at {{School Name}}. Please settle soon. Thank you.",
  },
  {
    name: "Payment Confirmation",
    category: "PAYMENT_CONFIRMATION",
    body: "Dear {{Parent Name}}, we received {{Amount}} for {{Student Name}}. Receipt: {{Receipt Number}}. Thank you — {{School Name}}.",
  },
  {
    name: "Attendance Alert",
    category: "ATTENDANCE",
    body: "Dear {{Parent Name}}, {{Student Name}} was marked absent on {{Date}}. — {{School Name}}",
  },
  {
    name: "Exam Announcement",
    category: "EXAM_ANNOUNCEMENT",
    body: "Dear {{Parent Name}}, {{Exam Name}} for {{Class}} starts on {{Date}}. — {{School Name}}",
  },
  {
    name: "Exam Result",
    category: "EXAM_RESULT",
    body: "Dear {{Parent Name}}, {{Student Name}} scored {{Marks}} in {{Exam Name}}. — {{School Name}}",
  },
  {
    name: "Exam Submission Reminder",
    category: "EXAM_ANNOUNCEMENT",
    body: "{{School Name}}: Please submit {{Exam Name}} marks for {{Class}} as soon as possible. Thank you.",
  },
  {
    name: "Registration Confirmation",
    category: "REGISTRATION",
    body: "Welcome! {{Student Name}} ({{Student ID}}) is registered at {{School Name}} for {{Academic Year}}.",
  },
  {
    name: "Emergency Notice",
    category: "EMERGENCY",
    body: "EMERGENCY from {{School Name}}: {{Message}}. Please contact the school immediately.",
  },
];
