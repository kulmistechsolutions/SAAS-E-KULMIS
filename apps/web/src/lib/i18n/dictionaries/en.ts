/**
 * English is the source of truth: its shape is the `Dictionary` type every
 * other language must satisfy, so a missing or misspelled key fails the build
 * rather than silently rendering the key name to a school.
 */
import { generated } from "./generated";

/**
 * Hand-written namespaces. These are the shared vocabulary and the screens
 * translated deliberately; `generated` holds everything the codemod lifted
 * out of the remaining pages.
 */
const core = {
  common: {
    /** Header for the classic Grade 1-12 list in a class picker, alongside a custom structure's own groups. */
    defaultGrades: "Grade (Default)",
    save: "Save",
    saving: "Saving…",
    cancel: "Cancel",
    close: "Close",
    delete: "Delete",
    edit: "Edit",
    view: "View",
    add: "Add",
    create: "Create",
    update: "Update",
    search: "Search",
    filter: "Filter",
    clear: "Clear",
    export: "Export",
    import: "Import",
    print: "Print",
    download: "Download",
    upload: "Upload",
    back: "Back",
    next: "Next",
    previous: "Previous",
    submit: "Submit",
    confirm: "Confirm",
    yes: "Yes",
    no: "No",
    all: "All",
    none: "None",
    loading: "Loading…",
    noData: "No data yet",
    noResults: "No results found",
    actions: "Actions",
    status: "Status",
    active: "Active",
    inactive: "Inactive",
    name: "Name",
    fullName: "Full name",
    phone: "Phone",
    email: "Email",
    address: "Address",
    gender: "Gender",
    male: "Male",
    female: "Female",
    date: "Date",
    total: "Total",
    amount: "Amount",
    notes: "Notes",
    required: "Required",
    optional: "Optional",
    selected: "{count} selected",
    retry: "Try again",
    somethingWentWrong: "Something went wrong",
  },

  nav: {
    dashboard: "Dashboard",
    students: "Students",
    teachers: "Teachers",
    parents: "Parents",
    parentPortal: "Parent Portal",
    teacherPortal: "Teacher Portal",
    classesSections: "Classes & Sections",
    attendance: "Attendance",
    studentCases: "Student Cases",
    timetable: "Timetable",
    feeManagement: "Fee Management",
    salaryManagement: "Salary Management",
    expenseManagement: "Expense Management",
    examinations: "Examinations",
    promotions: "Promotions",
    onlineQuiz: "Online Quiz",
    finance: "Finance",
    sms: "SMS",
    smsPackages: "SMS Packages",
    library: "Library",
    reports: "Reports",
    usersRoles: "Users & Roles",
    settings: "Settings",
    systemLogs: "System Logs",

    myProfile: "My Profile",
    myStudents: "My Students",
    myTimetable: "My Timetable",
    myAssignments: "My Assignments",
    announcements: "Announcements",

    // Sub-navigation, shared across several groups.
    classes: "Classes",
    sections: "Sections",
    subjects: "Subjects",
    academicYears: "Academic Years",
    timetables: "Timetables",
    setup: "Setup",
    collectFees: "Collect Fees",
    feeHistory: "Fee History",
    freeStudents: "Free Students",
    monthlySetup: "Monthly Setup",
    academicYearSetup: "Academic Year Setup",
    extraFees: "Extra Fees",
    receipts: "Receipts",
    monthlyPayroll: "Monthly Payroll",
    employees: "Employees",
    salaryHistory: "Salary History",
    expenseList: "Expense List",
    categories: "Categories",
    createExam: "Create Exam",
    enterMarks: "Enter Marks",
    importMarks: "Import Marks",
    monitoring: "Monitoring",
    examGroups: "Exam Groups",
    results: "Results",
    blockedStudents: "Blocked Students",
    promoteStudents: "Promote Students",
    graduatedStudents: "Graduated Students",
    history: "History",
    eligibilityRules: "Eligibility Rules",
    allQuizzes: "All Quizzes",
    myQuizzes: "My Quizzes",
    createQuiz: "Create Quiz",
    allUsers: "All Users",
    rolesPermissions: "Roles & Permissions",

    quickLinks: "Quick Links",
    comingSoon: "Coming soon",
    allSystemsOperational: "All systems operational",
    viewResults: "View Results",
    takeAttendance: "Take Attendance",
  },

  dashboard: {
    totalStudents: "Total Students",
    totalTeachers: "Total Teachers",
    totalParents: "Total Parents",
    totalClasses: "Total Classes",
    totalSubjects: "Total Subjects",
    feesOutstanding: "Fees Outstanding",
    totalCollected: "Total Collected",
    income: "Income",
    expenses: "Expenses",
    netIncome: "Net Income",
    studentAttendance: "Student attendance",
    present: "Present",
    absent: "Absent",
    late: "Late",
    registered: "Registered",
    quickActions: "Quick Actions",
    addStudent: "Add Student",
    addExpense: "Add Expense",
    collectFees: "Collect Fees",
    takeAttendance: "Take Attendance",
    createExam: "Create Exam",
    createQuiz: "Create Quiz",
    sendNotice: "Send Notice",
    generateReport: "Generate Report",
    recentActivities: "Recent Activities",
    recentPayments: "Recent Payments",
    upcomingExams: "Upcoming Exams",
    alertsNotifications: "Alerts & Notifications",
    studentAdmissionTrend: "Student Admission Trend",
    systemInformation: "System Information",
    serverStatus: "Server Status",
    databaseStatus: "Database Status",
    online: "Online",
    connected: "Connected",
    allSystemsNormal: "All systems operating normally",
    viewAll: "View All",
    loadFailed: "Failed to load dashboard data",
    todaysAttendance: "Today's Attendance",
    feeCollectionMonth: "Fee Collection (Month)",
    academicYear: "Academic Year",
    thisMonth: "+{count} this month",
  },

  students: {
    loadingStudents: "Loading students…",
    students: "Students",
    manageStudentRecordsRegistrationAndProfiles:
      "Manage student records, registration, and profiles.",
    print: "Print",
    export: "Export",
    import: "Import",
    addStudent: "Add Student",
    searchByIdNameParentOr: "Search by ID, name, parent, or phone…",
    allClasses: "All Classes",
    allSections: "All Sections",
    section: "Section",
    allGenders: "All Genders",
    male: "Male",
    female: "Female",
    allStatus: "All Status",
    active: "Active",
    inactive: "Inactive",
    graduated: "Graduated",
    clear: "Clear",
    student: "student",
    selected: "selected",
    deleteSelected: "Delete selected",
    selectAllOnThisPage: "Select all on this page",
    studentId: "Student ID",
    name: "Name",
    gender: "Gender",
    parent: "Parent",
    parentPhone: "Parent Phone",
    class: "Class",
    monthlyFee: "Monthly Fee",
    regDate: "Reg. Date",
    status: "Status",
    actions: "Actions",
    viewProfile: "View Profile",
    edit: "Edit",
    printProfile: "Print Profile",
    downloadProfile: "Download Profile",
    delete: "Delete",
    resetDemoData: "Reset demo data",
    deleteStudent: "Delete Student",
    deleteSelectedStudents: "Delete selected students",
  },

  topbar: {
    openMenu: "Open menu",
    searchPlaceholder: "Search students, teachers, parents…",
    academicYear: "Academic Year:",
    notifications: "Notifications",
    profile: "Profile",
    logout: "Log out",
    language: "Language",
    theme: "Theme",
  },

  auth: {
    signIn: "Sign in",
    signingIn: "Signing in…",
    username: "Username",
    password: "Password",
    rememberMe: "Remember me",
    invalidCredentials: "Invalid credentials",
    welcomeBack: "Welcome back",
    signInToContinue: "Sign in to continue",
    changePassword: "Change password",
    currentPassword: "Current password",
    newPassword: "New password",
    confirmPassword: "Confirm password",
    passwordsDoNotMatch: "The passwords do not match",
    passwordChanged: "Password changed",
    idOrUsername: "ID / Username",
    showPassword: "Show password",
    hidePassword: "Hide password",
    wrongCredentials:
      "Wrong username or password. Please check both and try again.",
    noSchoolLinked:
      "This sign-in page isn't linked to a school. Open your school's own address (e.g. yourschool.ekulmis.com) and sign in there.",
    loginFailed: "Login failed. Please try again.",
  },
} as const;

export const en = {
  ...generated,
  ...core,
  // Both halves contribute keys to these two, so merge rather than replace.
  dashboard: { ...generated.dashboard, ...core.dashboard },
  students: { ...generated.students, ...core.students },
} as const;

/**
 * Values widened to `string`. `as const` above pins every value to its own
 * literal type, which is what makes the key paths exact — but a translation
 * is not the English text, so only the keys are held to.
 */
type Widen<T> = {
  [K in keyof T]: T[K] extends string ? string : Widen<T[K]>;
};

/** The shape every language must provide. */
export type Dictionary = Widen<typeof en>;

/**
 * What a translation file may provide: any subset. Translating 1,900 strings
 * is not one commit, and holding Somali and Arabic to the complete shape
 * would mean no key could be added until both were finished. Anything missing
 * falls back to English at runtime — see the provider — so a partial
 * dictionary reads correctly rather than showing dotted key paths.
 */
type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

export type PartialDictionary = DeepPartial<Dictionary>;
