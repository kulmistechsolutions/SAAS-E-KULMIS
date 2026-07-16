/** Render SMS templates: {{Student Name}}, {{Parent Name}}, {{Magaca Ardayga}}, etc. */
const ALIASES: Record<string, string[]> = {
  studentName: [
    "Student Name",
    "student_name",
    "studentName",
    "StudentName",
    "Magaca Ardayga",
    "Magaca Cunuga",
  ],
  parentName: [
    "Parent Name",
    "parent_name",
    "parentName",
    "ParentName",
    "Magaca Waalidka",
  ],
  schoolName: [
    "School Name",
    "school_name",
    "schoolName",
    "SchoolName",
    "Magaca Dugsiga",
    "Magaca Iskuulka",
  ],
  className: [
    "Class",
    "class",
    "className",
    "Class Name",
    "Fasalka",
  ],
  section: ["Section", "section", "Xarunta"],
  outstandingBalance: [
    "Outstanding Balance",
    "Balance",
    "outstanding",
    "outstandingBalance",
    "Lacagta Hadhaysa",
    "Deynta",
  ],
  dueDate: ["Due Date", "dueDate", "DueDate", "Taariikhda Dhammaadka"],
  academicYear: [
    "Academic Year",
    "academicYear",
    "AcademicYear",
    "Year",
    "Sanad Dugsiyeedka",
  ],
  amount: ["Amount", "amount", "Paid Amount", "Lacagta"],
  receiptNumber: [
    "Receipt Number",
    "receiptNumber",
    "Receipt",
    "Lambarka Rasiidhka",
  ],
  studentCode: ["Student ID", "studentCode", "Student Code", "Lambarka Ardayga"],
  examName: ["Exam Name", "examName", "Exam", "Imtixaanka"],
  marks: ["Marks", "marks", "Score", "Dhibcaha"],
  date: ["Date", "date", "Taariikhda"],
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
    name: "Xasuusin Lacag (Fee Reminder)",
    category: "FEE_REMINDER",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} ({{Fasalka}}) wuxuu leeyahay lacag hadhaysa oo dhan {{Lacagta Hadhaysa}} oo lagu leeyahay {{Magaca Dugsiga}}. Fadlan dib u bixi. Mahadsanid.",
  },
  {
    name: "Xaqiijinta Lacag (Payment Confirmation)",
    category: "PAYMENT_CONFIRMATION",
    body: "Salaan {{Magaca Waalidka}}, waxaan helnay {{Lacagta}} ee {{Magaca Ardayga}}. Rasiidhka: {{Lambarka Rasiidhka}}. Mahadsanid — {{Magaca Dugsiga}}.",
  },
  {
    name: "Digniin Xaadirin (Attendance Alert)",
    category: "ATTENDANCE",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} ma joogin dugsiga {{Taariikhda}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Imtixaan (Exam Announcement)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}}, {{Imtixaanka}} ee {{Fasalka}} wuxuu bilaabmayaa {{Taariikhda}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Natiijada Imtixaanka (Exam Result)",
    category: "EXAM_RESULT",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} wuxuu ku dhacay {{Dhibcaha}} imtixaankii {{Imtixaanka}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Diiwaan Dhibco (Exam Submission Reminder)",
    category: "EXAM_ANNOUNCEMENT",
    body: "{{Magaca Dugsiga}}: Fadlan soo gudbi dhibcaha {{Imtixaanka}} ee {{Fasalka}} sida ugu dhaqsaha badan. Mahadsanid.",
  },
  {
    name: "Xaqiijinta Diiwaangelinta (Registration Confirmation)",
    category: "REGISTRATION",
    body: "Soo dhawoow! {{Magaca Ardayga}} ({{Lambarka Ardayga}}) waa la diiwaan geliyay {{Magaca Dugsiga}} sanadka {{Sanad Dugsiyeedka}}.",
  },
  {
    name: "Ogeysiis Degdeg ah (Emergency Notice)",
    category: "EMERGENCY",
    body: "OGEYSIIS DEGDEG AH oo ka socda {{Magaca Dugsiga}}: {{Fariinta}}. Fadlan degdeg ula soo xiriir dugsiga.",
  },
];
