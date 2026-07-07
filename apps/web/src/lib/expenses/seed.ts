import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { monthKey, referenceNo } from "./format";
import type {
  Expense,
  ExpenseCategory,
  ExpensesState,
  RecurringExpense,
} from "./types";

const DEFAULT_CATEGORIES = [
  "Teacher Salaries",
  "Staff Salaries",
  "Electricity",
  "Water",
  "Internet",
  "Office Supplies",
  "Stationery",
  "Furniture",
  "Building Maintenance",
  "Transportation",
  "School Events",
  "Security",
  "Cleaning",
  "Marketing",
  "Software Licenses",
  "Equipment",
  "Miscellaneous",
];

const VENDORS = [
  "City Power Co.",
  "Aqua Water Services",
  "Somtel Internet",
  "Office Mart Ltd",
  "SecureGuard Services",
  "CleanPro Agency",
  "Transport Solutions",
  "Tech Supplies Inc.",
];

function buildCategories(): ExpenseCategory[] {
  const now = new Date().toISOString();
  return DEFAULT_CATEGORIES.map((name, i) => ({
    id: `cat_${i + 1}`,
    name,
    status: "ACTIVE" as const,
    createdAt: now,
  }));
}

function buildExpenses(categories: ExpenseCategory[]): Expense[] {
  const academicYear = ACTIVE_ACADEMIC_YEAR;
  const now = new Date();
  const expenses: Expense[] = [];
  let seq = 1;

  const samples: {
    title: string;
    cat: string;
    amount: number;
    daysAgo: number;
    method: Expense["paymentMethod"];
  }[] = [
    { title: "Monthly Electricity Bill", cat: "Electricity", amount: 420, daysAgo: 1, method: "BANK_TRANSFER" },
    { title: "Internet Subscription", cat: "Internet", amount: 180, daysAgo: 3, method: "MOBILE_MONEY" },
    { title: "Office Stationery Purchase", cat: "Stationery", amount: 95, daysAgo: 5, method: "CASH" },
    { title: "Building Repairs — Roof", cat: "Building Maintenance", amount: 1250, daysAgo: 8, method: "CHEQUE" },
    { title: "Security Services", cat: "Security", amount: 350, daysAgo: 12, method: "BANK_TRANSFER" },
    { title: "School Event Catering", cat: "School Events", amount: 680, daysAgo: 15, method: "CASH" },
    { title: "Water Utility Payment", cat: "Water", amount: 120, daysAgo: 18, method: "BANK_TRANSFER" },
    { title: "Cleaning Supplies", cat: "Cleaning", amount: 75, daysAgo: 22, method: "CASH" },
    { title: "Transport Fuel", cat: "Transportation", amount: 240, daysAgo: 28, method: "MOBILE_MONEY" },
    { title: "Software License Renewal", cat: "Software Licenses", amount: 450, daysAgo: 35, method: "BANK_TRANSFER" },
    { title: "Office Furniture", cat: "Furniture", amount: 890, daysAgo: 42, method: "CHEQUE" },
    { title: "Marketing Flyers", cat: "Marketing", amount: 160, daysAgo: 50, method: "CASH" },
    { title: "Equipment — Projectors", cat: "Equipment", amount: 2100, daysAgo: 60, method: "BANK_TRANSFER" },
    { title: "Miscellaneous Supplies", cat: "Miscellaneous", amount: 55, daysAgo: 70, method: "CASH" },
    { title: "Office Supplies Restock", cat: "Office Supplies", amount: 210, daysAgo: 0, method: "CASH" },
  ];

  for (const s of samples) {
    const cat = categories.find((c) => c.name === s.cat);
    if (!cat) continue;
    const d = new Date(now);
    d.setDate(d.getDate() - s.daysAgo);
    const expenseDate = d.toISOString().slice(0, 10);
    const createdAt = d.toISOString();
    expenses.push({
      id: `exp_${seq}`,
      referenceNo: referenceNo(seq),
      title: s.title,
      categoryId: cat.id,
      amount: s.amount,
      expenseDate,
      academicYear,
      paymentMethod: s.method,
      paidTo: VENDORS[seq % VENDORS.length],
      description: `Recorded expense for ${s.title.toLowerCase()}.`,
      attachment: null,
      recordedBy: "Finance Officer",
      status: "RECORDED",
      createdAt,
      updatedAt: createdAt,
    });
    seq += 1;
  }

  return expenses;
}

function buildRecurring(categories: ExpenseCategory[]): RecurringExpense[] {
  const academicYear = ACTIVE_ACADEMIC_YEAR;
  const now = new Date().toISOString();
  const find = (name: string) => categories.find((c) => c.name === name)?.id ?? categories[0].id;

  return [
    {
      id: "rec_1",
      title: "Monthly Internet",
      categoryId: find("Internet"),
      amount: 180,
      paymentMethod: "BANK_TRANSFER",
      paidTo: "Somtel Internet",
      frequency: "MONTHLY",
      nextDueDate: monthKey() + "-05",
      academicYear,
      active: true,
      description: "School broadband subscription",
      createdAt: now,
    },
    {
      id: "rec_2",
      title: "Electricity — Monthly",
      categoryId: find("Electricity"),
      amount: 420,
      paymentMethod: "BANK_TRANSFER",
      paidTo: "City Power Co.",
      frequency: "MONTHLY",
      nextDueDate: monthKey() + "-10",
      academicYear,
      active: true,
      createdAt: now,
    },
  ];
}

export function buildSeed(): ExpensesState {
  const categories = buildCategories();
  const expenses = buildExpenses(categories);
  const recurring = buildRecurring(categories);

  return {
    categories,
    expenses,
    recurring,
    audit: [
      {
        id: "exp_audit_1",
        action: "Expense Created",
        user: "Admin User",
        role: "ADMINISTRATOR",
        referenceNo: expenses[0]?.referenceNo,
        at: new Date().toISOString(),
        detail: "Seed data initialized",
      },
    ],
    expenseSeq: expenses.length,
    academicYear: ACTIVE_ACADEMIC_YEAR,
    maxAttachmentMb: 5,
  };
}
