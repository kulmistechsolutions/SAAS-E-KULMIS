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
  className: ["Class", "class", "className", "Class Name", "Fasalka"],
  section: ["Section", "section", "Qaybta"],
  outstandingBalance: [
    "Outstanding Balance",
    "Balance",
    "outstanding",
    "outstandingBalance",
    "Lacagta Hadhaysa",
    "Lacagta Hadhay",
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
  studentCode: [
    "Student ID",
    "studentCode",
    "Student Code",
    "Lambarka Ardayga",
  ],
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

  // Both spellings. The system's own templates are written {{Magaca Ardayga}};
  // schools writing an exam-result template from the handbook write
  // {student_name}. Refusing one of them would have meant every school
  // learning which of the two this particular screen wanted.
  //
  // Doubles first, so {{x}} is never read as a single {x} wrapped in braces.
  const withDoubles = body.replace(
    /\{\{\s*([^{}]+?)\s*\}\}/g,
    (whole, raw: string) => substitute(flat, raw, whole),
  );
  return withDoubles.replace(
    /\{\s*([^{}]+?)\s*\}/g,
    (whole, raw: string) => substitute(flat, raw, whole),
  );
}

/**
 * One placeholder, or nothing when no value answers to it.
 *
 * Blanking rather than leaving the braces standing, because that is what every
 * template in the system has always done and what the built-in emergency
 * notice relies on — {{Farriinta}} is a slot the sender fills, not a variable.
 * A name nobody fills is a mistake the screen catches before sending: the
 * composer warns about unknown placeholders, and the exam-result preview lists
 * them per student.
 */
function substitute(
  flat: Record<string, string>,
  raw: string,
  _whole: string,
): string {
  const key = String(raw).trim();
  return flat[key] ?? flat[key.toLowerCase()] ?? "";
}

/**
 * Kept to one GSM-7 SMS segment (≤160 chars) after variable substitution —
 * these used to run "\n\n"-separated with a repeated "Mahadsanid" sign-off,
 * so every send billed 2-3 segments for what fits in one. Single line, one
 * sign-off, no filler.
 */
export const DEFAULT_TEMPLATES: {
  name: string;
  category: string;
  body: string;
}[] = [
  {
    name: "Digniin Xaadirin (Attendance Alert)",
    category: "ATTENDANCE",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} kama iman dugsiga {{Taariikhda}}. Xiriir xafiiska haddii aad wax weyddiineyso. - {{Magaca Dugsiga}}",
  },
  {
    name: "Natiijada Imtixaanka (Exam Result)",
    category: "EXAM_RESULT",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} wuxuu ku dhacay {{Dhibcaha}} imtixaanka {{Imtixaanka}}. Guul! - {{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Degdeg ah (Emergency Notice)",
    category: "EMERGENCY",
    body: "OGEYSIIS DEGDEG AH: {{Farriinta}} - {{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Imtixaan (Exam Announcement)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}}, imtixaanka {{Imtixaanka}} ee fasalka {{Fasalka}} wuxuu bilaabmayaa {{Taariikhda}}. Diyaari ardayga. - {{Magaca Dugsiga}}",
  },
  {
    name: "Xaqiijinta Diiwaangelinta (Registration Confirmation)",
    category: "REGISTRATION",
    body: "Ku soo dhawoow {{Magaca Dugsiga}}. {{Magaca Ardayga}} (ID: {{Lambarka Ardayga}}) waa la diiwaan geliyay sanadka {{Sanad Dugsiyeedka}}.",
  },
  {
    name: "Xaqiijinta Lacag-bixinta (Payment Confirmation)",
    category: "PAYMENT_CONFIRMATION",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} wuxuu bixiyay {{Lacagta}}. Rasiid #{{Lambarka Rasiidhka}}. - {{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Gudbinta Dhibcaha (Exam Submission Reminder)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Xasuusin: Macallin, fadlan soo gudbi dhibcaha {{Imtixaanka}} ee fasalka {{Fasalka}} dhaqso. - {{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Lacag-bixin (Fee Reminder)",
    category: "FEE_REMINDER",
    body: "Salaan {{Magaca Waalidka}}, {{Magaca Ardayga}} (fasalka {{Fasalka}}) wuxuu leeyahay lacag hadhay {{Lacagta Hadhay}}. Fadlan bixi. - {{Magaca Dugsiga}}",
  },
  {
    name: "Soo Dhawayn (Welcome SMS)",
    category: "ADMISSION",
    body: "Ku soo dhawoow {{Magaca Dugsiga}}! Waan ku faraxsanahay inaad nagu biirtay. Sanad guul leh! - {{Magaca Dugsiga}}",
  },
  {
    name: "Dhalasho Wacan (Birthday)",
    category: "ANNOUNCEMENT",
    body: "Dhalasho wacan {{Magaca Ardayga}}! Waxaan kuu rajaynaynaa caafimaad iyo guulo badan. - {{Magaca Dugsiga}}",
  },
  {
    name: "Fasax Dugsi (School Holiday)",
    category: "ANNOUNCEMENT",
    body: "Ogeysiis: Dugsigu waa fasax laga bilaabo {{Taariikhda Bilaabashada}} ilaa {{Taariikhda Dhamaadka}}. - {{Magaca Dugsiga}}",
  },
  {
    name: "Shirka Waalidiinta (Parent Meeting)",
    category: "ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}}, waxaad ku casuusan tahay kulanka waalidiinta {{Taariikhda}} saacadda {{Waqtiga}} ee {{Goobta}}. - {{Magaca Dugsiga}}",
  },
];
