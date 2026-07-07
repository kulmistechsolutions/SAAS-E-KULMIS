export type CategoryStatus = "ACTIVE" | "INACTIVE";
export type ExpenseStatus = "RECORDED" | "PENDING" | "DELETED";
export type PaymentMethod =
  | "CASH"
  | "BANK_TRANSFER"
  | "MOBILE_MONEY"
  | "CHEQUE"
  | "OTHER";

export type RecurringFrequency = "MONTHLY" | "QUARTERLY" | "YEARLY";

export interface ExpenseCategory {
  id: string;
  name: string;
  status: CategoryStatus;
  createdAt: string;
}

export interface ExpenseAttachment {
  id: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  uploadedAt: string;
}

export interface Expense {
  id: string;
  referenceNo: string;
  title: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  academicYear: string;
  paymentMethod: PaymentMethod;
  paidTo: string;
  description?: string | null;
  attachment?: ExpenseAttachment | null;
  recordedBy: string;
  status: ExpenseStatus;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringExpense {
  id: string;
  title: string;
  categoryId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidTo: string;
  frequency: RecurringFrequency;
  nextDueDate: string;
  academicYear: string;
  active: boolean;
  description?: string | null;
  createdAt: string;
}

export interface ExpenseAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  referenceNo?: string;
  at: string;
  detail?: string;
}

export interface ExpensesState {
  categories: ExpenseCategory[];
  expenses: Expense[];
  recurring: RecurringExpense[];
  audit: ExpenseAuditEntry[];
  expenseSeq: number;
  academicYear: string;
  maxAttachmentMb: number;
}

export interface ExpenseDashboardSummary {
  totalExpensesToday: number;
  totalExpensesThisMonth: number;
  totalExpensesThisYear: number;
  totalCategories: number;
  highestExpenseCategory: string;
  pendingExpenses: number;
  netIncome: number;
  totalFinancialOutflow: number;
  totalIncome: number;
  totalSalaries: number;
}

export interface ExpenseRow {
  id: string;
  serial: number;
  referenceNo: string;
  title: string;
  categoryName: string;
  amount: number;
  paymentMethod: PaymentMethod;
  expenseDate: string;
  recordedBy: string;
  paidTo: string;
  status: ExpenseStatus;
}

export interface CreateExpenseInput {
  title: string;
  categoryId: string;
  amount: number;
  expenseDate: string;
  academicYear?: string;
  paymentMethod: PaymentMethod;
  paidTo: string;
  description?: string | null;
  attachment?: ExpenseAttachment | null;
  recordedBy?: string;
  status?: ExpenseStatus;
}

export interface UpdateExpenseInput {
  id: string;
  title?: string;
  categoryId?: string;
  amount?: number;
  expenseDate?: string;
  paymentMethod?: PaymentMethod;
  paidTo?: string;
  description?: string | null;
  attachment?: ExpenseAttachment | null;
  status?: ExpenseStatus;
}

export interface CreateCategoryInput {
  name: string;
}

export type ExpenseSortKey = "expenseDate" | "amount" | "category" | "title";
export type ExpenseSortDir = "asc" | "desc";
