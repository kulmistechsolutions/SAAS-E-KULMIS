/** Render SMS templates: {{Student Name}}, {{Parent Name}}, {{Magaca Ardayga}}, etc. */
const ALIASES: Record<string, string[]> = {
  studentName: [
    "Student Name",
    "student_name",
    "studentName",
    "StudentName",
    "Magaca Ardayga",
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
  ],
  className: [
    "Class",
    "class",
    "className",
    "Class Name",
    "Fasalka",
  ],
  section: ["Section", "section", "Qaybta"],
  outstandingBalance: [
    "Outstanding Balance",
    "Balance",
    "outstanding",
    "outstandingBalance",
    "Lacagta Hadhaysa",
    "Deynta",
  ],
  dueDate: ["Due Date", "dueDate", "DueDate", "Taariikhda Ugu Dambeysa"],
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
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} ee {{Fasalka}} wuxuu ku leeyahay {{Magaca Dugsiga}} lacag hadhaysa oo dhan {{Lacagta Hadhaysa}}. Fadlan dib u bixi lacagta. Mahadsanid.",
  },
  {
    name: "Xaqiijinta Lacag (Payment Confirmation)",
    category: "PAYMENT_CONFIRMATION",
    body: "Salaan {{Magaca Waalidka}}, waxaan si buuxda u helnay {{Lacagta}} ee aad u bixisay {{Magaca Ardayga}}. Lambarka Rasiidhka: {{Lambarka Rasiidhka}}. Mahadsanid — {{Magaca Dugsiga}}.",
  },
  {
    name: "Digniin Xaadirin (Attendance Alert)",
    category: "ATTENDANCE",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} kama uu iman dugsiga taariikhda {{Taariikhda}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Imtixaan (Exam Announcement)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}}, {{Imtixaanka}} ee {{Fasalka}} wuxuu bilaabanayaa {{Taariikhda}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Natiijada Imtixaanka (Exam Result)",
    category: "EXAM_RESULT",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} wuxuu ka helay {{Dhibcaha}} dhibcood imtixaankii {{Imtixaanka}}. — {{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Diiwaan Dhibco (Exam Submission Reminder)",
    category: "EXAM_ANNOUNCEMENT",
    body: "{{Magaca Dugsiga}}: Fadlan soo gudbi dhibcaha {{Imtixaanka}} ee {{Fasalka}} sida ugu dhaqsaha badan. Mahadsanid.",
  },
  {
    name: "Xaqiijinta Diiwaangelinta (Registration Confirmation)",
    category: "REGISTRATION",
    body: "Soo dhawoow {{Magaca Dugsiga}}! {{Magaca Ardayga}} (Lambarka: {{Lambarka Ardayga}}) waa lagu diiwaan geliyay sanad-dugsiyeedka {{Sanad Dugsiyeedka}}.",
  },
  {
    name: "Ogeysiis Degdeg ah (Emergency Notice)",
    category: "EMERGENCY",
    body: "OGEYSIIS DEGDEG AH — {{Magaca Dugsiga}}: {{Fariinta}}. Fadlan isla markiiba nala soo xiriir.",
  },
];
