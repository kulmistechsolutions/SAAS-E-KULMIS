/**
 * Static demo data for the admin dashboard.
 *
 * These values mirror the reference design so the dashboard renders a complete,
 * polished picture out of the box. Swap these for live API data (see
 * `/dashboard/admin`) when connecting to the backend.
 */

export const stats = [
  {
    key: "students",
    label: "Total Students",
    value: "3,245",
    hint: "+12 this month",
    hintTone: "up" as const,
    icon: "students" as const,
    theme: "violet" as const,
  },
  {
    key: "teachers",
    label: "Total Teachers",
    value: "186",
    hint: "+3 this month",
    hintTone: "up" as const,
    icon: "teachers" as const,
    theme: "emerald" as const,
  },
  {
    key: "parents",
    label: "Total Parents",
    value: "2,890",
    hint: "+18 this month",
    hintTone: "up" as const,
    icon: "parents" as const,
    theme: "amber" as const,
  },
  {
    key: "classes",
    label: "Total Classes",
    value: "78",
    hint: "15 Sections",
    hintTone: "muted" as const,
    icon: "classes" as const,
    theme: "sky" as const,
  },
  {
    key: "fees",
    label: "Fees Outstanding",
    value: "$48,760",
    hint: "236 Students",
    hintTone: "muted" as const,
    icon: "fees" as const,
    theme: "rose" as const,
  },
  {
    key: "attendance",
    label: "Today's Attendance",
    value: "92.4%",
    hint: "Present",
    hintTone: "muted" as const,
    icon: "attendance" as const,
    theme: "teal" as const,
  },
];

export const attendanceBreakdown = {
  total: 3245,
  segments: [
    { name: "Present", value: 2995, percent: "92.4%", color: "#22c55e" },
    { name: "Absent", value: 180, percent: "5.5%", color: "#ef4444" },
    { name: "Late", value: 70, percent: "2.1%", color: "#f59e0b" },
  ],
};

export const feeCollection = {
  total: "$162,890",
  change: "+18.6% vs last month",
  series: [
    { label: "1 May", value: 40000 },
    { label: "5 May", value: 55000 },
    { label: "9 May", value: 72000 },
    { label: "14 May", value: 98000 },
    { label: "18 May", value: 120000 },
    { label: "21 May", value: 150000 },
    { label: "26 May", value: 175000 },
    { label: "31 May", value: 200000 },
  ],
};

export const incomeVsExpense = {
  income: "$245,000",
  expenses: "$142,500",
  netIncome: "$102,500",
  series: [
    { label: "Week 1", income: 210000, expense: 120000 },
    { label: "Week 2", income: 245000, expense: 140000 },
    { label: "Week 3", income: 230000, expense: 155000 },
    { label: "Week 4", income: 265000, expense: 135000 },
    { label: "Week 5", income: 245000, expense: 142500 },
  ],
};

export const upcomingExams = [
  {
    day: "28",
    month: "MAY",
    title: "Mid Term Examination",
    subtitle: "Grade 10 - All Sections",
  },
  {
    day: "30",
    month: "MAY",
    title: "Science Examination",
    subtitle: "Grade 8 - Section A",
  },
  {
    day: "31",
    month: "MAY",
    title: "English Test",
    subtitle: "Grade 6 - All Sections",
  },
  {
    day: "02",
    month: "JUN",
    title: "Maths Examination",
    subtitle: "Grade 9 - Section B",
  },
];

export const recentActivities = [
  { text: "New student John Doe registered", color: "#3b82f6" },
  { text: "Fees payment of $250 by Sarah Smith", color: "#f59e0b" },
  { text: "Exam Mid Term Examination created", color: "#ef4444" },
  { text: "Attendance marked for today", color: "#8b5cf6" },
  { text: "Quiz Mathematics Quiz published", color: "#22c55e" },
];

export const alerts = [
  {
    text: "236 students have outstanding fees",
    icon: "alert" as const,
    tone: "rose" as const,
  },
  {
    text: "5 teachers have not marked attendance",
    icon: "alert" as const,
    tone: "amber" as const,
  },
  {
    text: "3 exams are waiting for marks",
    icon: "info" as const,
    tone: "sky" as const,
  },
  {
    text: "2 quizzes are pending review",
    icon: "info" as const,
    tone: "sky" as const,
  },
  {
    text: "Backup completed successfully",
    icon: "check" as const,
    tone: "emerald" as const,
  },
];

export const quickActions = [
  { label: "Add Student", icon: "add-student" as const, theme: "violet" as const },
  { label: "Collect Fees", icon: "collect-fees" as const, theme: "emerald" as const },
  { label: "Take Attendance", icon: "attendance" as const, theme: "sky" as const },
  { label: "Create Exam", icon: "exam" as const, theme: "amber" as const },
  { label: "Create Quiz", icon: "quiz" as const, theme: "violet" as const },
  { label: "Add Expense", icon: "expense" as const, theme: "rose" as const },
  { label: "Generate Report", icon: "report" as const, theme: "teal" as const },
  { label: "Send Notice", icon: "notice" as const, theme: "amber" as const },
  { label: "Calendar", icon: "calendar" as const, theme: "sky" as const },
];

export const admissionTrend = [
  { label: "Jan", value: 120 },
  { label: "Feb", value: 95 },
  { label: "Mar", value: 150 },
  { label: "Apr", value: 110 },
  { label: "May", value: 165 },
  { label: "Jun", value: 90 },
  { label: "Jul", value: 140 },
  { label: "Aug", value: 175 },
  { label: "Sep", value: 130 },
  { label: "Oct", value: 155 },
  { label: "Nov", value: 100 },
  { label: "Dec", value: 145 },
];

export const topClasses = [
  { label: "Grade 10 - Section A", value: 45, capacity: 45 },
  { label: "Grade 9 - Section B", value: 43, capacity: 45 },
  { label: "Grade 8 - Section A", value: 42, capacity: 45 },
  { label: "Grade 7 - Section C", value: 40, capacity: 45 },
  { label: "Grade 6 - Section B", value: 38, capacity: 45 },
];

export const systemInfo = [
  { label: "Academic Year", value: "2024-2025", tone: "default" as const },
  { label: "Current Session", value: "May 24, 2024 - Active", tone: "default" as const },
  { label: "Database Status", value: "Connected", tone: "success" as const },
  { label: "Last Backup", value: "May 24, 2024 02:00 AM", tone: "default" as const },
  { label: "System Version", value: "v2.5.0", tone: "default" as const },
  { label: "Server Status", value: "Online", tone: "success" as const },
];
