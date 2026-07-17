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
    name: "Digniin Xaadirin (Attendance Alert)",
    category: "ATTENDANCE",
    body: "Salaan {{Magaca Waalidka}},\n\nWaxaan ku wargelinaynaa in ardaygaaga {{Magaca Ardayga}} uusan maanta oo taariikhdu tahay {{Taariikhda}} soo xaadirin dugsiga.\n\nHaddii aad qabto wax faahfaahin ah, fadlan nala soo xiriir.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Natiijada Imtixaanka (Exam Result)",
    category: "EXAM_RESULT",
    body: "Salaan {{Magaca Waalidka}},\n\nArdaygaaga {{Magaca Ardayga}} wuxuu helay {{Dhibcaha}} imtixaanka {{Imtixaanka}}.\n\nWaxaan u rajaynaynaa guul iyo horumar.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Degdeg ah (Emergency Notice)",
    category: "EMERGENCY",
    body: "OGEYSIIS DEGDEG AH\n\n{{Farriinta}}\n\nFadlan si degdeg ah ula soco ogeysiiskan ama nala soo xiriir haddii loo baahdo.\n\n{{Magaca Dugsiga}}",
  },
  {
    name: "Ogeysiis Imtixaan (Exam Announcement)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}},\n\nWaxaan ku wargelinaynaa in imtixaanka {{Imtixaanka}} ee fasalka {{Fasalka}} uu bilaaban doono {{Taariikhda}}.\n\nFadlan hubi in ardaygu diyaar u yahay.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Xaqiijinta Diiwaangelinta (Registration Confirmation)",
    category: "REGISTRATION",
    body: "Ku soo dhawoow {{Magaca Dugsiga}}.\n\nWaxaan xaqiijinay diiwaangelinta ardayga {{Magaca Ardayga}}.\n\nLambarka Ardayga: {{Lambarka Ardayga}}\n\nSanad Dugsiyeedka: {{Sanad Dugsiyeedka}}\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Xaqiijinta Lacag-bixinta (Payment Confirmation)",
    category: "PAYMENT_CONFIRMATION",
    body: "Salaan {{Magaca Waalidka}},\n\nWaxaan xaqiijinay helitaanka lacag dhan {{Lacagta}} oo laga bixiyay ardayga {{Magaca Ardayga}}.\n\nLambarka Rasiidka: {{Lambarka Rasiidhka}}\n\nWaad ku mahadsan tahay lacag-bixintaada.\n\n{{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Gudbinta Dhibcaha (Exam Submission Reminder)",
    category: "EXAM_ANNOUNCEMENT",
    body: "Xasuusin\n\nMacallin, fadlan soo gudbi dhibcaha imtixaanka {{Imtixaanka}} ee fasalka {{Fasalka}} sida ugu dhaqsaha badan.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Xasuusin Lacag-bixin (Fee Reminder)",
    category: "FEE_REMINDER",
    body: "Salaan {{Magaca Waalidka}},\n\nWaxaan ku xasuusinaynaa in ardayga {{Magaca Ardayga}} ee fasalka {{Fasalka}} uu wali leeyahay lacag dugsiyeed oo dhan {{Lacagta Hadhay}}.\n\nFadlan bixi lacagta si looga fogaado dib u dhac.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Soo Dhawayn (Welcome SMS)",
    category: "ADMISSION",
    body: "Ku soo dhawoow {{Magaca Dugsiga}}.\n\nWaxaan ku faraxsanahay inaad nagu soo biirtay. Waxaan kuu rajaynaynaa sanad dugsiyeed guul leh.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Dhalasho Wacan (Birthday)",
    category: "ANNOUNCEMENT",
    body: "Dhalasho Wacan {{Magaca Ardayga}}!\n\nWaxaan kuu rajaynaynaa caafimaad, farxad iyo guulo badan.\n\nHambalyo!\n{{Magaca Dugsiga}}",
  },
  {
    name: "Fasax Dugsi (School Holiday)",
    category: "ANNOUNCEMENT",
    body: "Salaan,\n\nWaxaan ku wargelinaynaa in dugsigu fasax noqon doono laga bilaabo {{Taariikhda Bilaabashada}} ilaa {{Taariikhda Dhamaadka}}.\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
  {
    name: "Shirka Waalidiinta (Parent Meeting)",
    category: "ANNOUNCEMENT",
    body: "Salaan {{Magaca Waalidka}},\n\nWaxaan kugu casuumeynaa kulanka waalidiinta oo dhici doona {{Taariikhda}} saacadda {{Waqtiga}}.\n\nGoobta: {{Goobta}}\n\nMahadsanid.\n{{Magaca Dugsiga}}",
  },
];
