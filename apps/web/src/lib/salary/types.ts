export type EmployeeType = "TEACHER" | "STAFF";
export type EmploymentStatus = "ACTIVE" | "INACTIVE";
export type PaymentMethod = "CASH" | "BANK_TRANSFER" | "MOBILE_MONEY" | "CHEQUE";
export type PayrollStatus = "PENDING" | "PARTIAL" | "PAID";

export type Position =
  | "Teacher"
  | "Administrator"
  | "Finance Officer"
  | "Attendance Officer"
  | "Receptionist"
  | "Security Staff"
  | "Cleaner"
  | "Other Staff";

export interface Employee {
  id: string;
  code: string;
  fullName: string;
  type: EmployeeType;
  /** Set when type is TEACHER. */
  teacherId?: string | null;
  position: Position;
  basicSalary: number;
  allowances: number;
  deductions: number;
  bonus: number;
  paymentMethod: PaymentMethod;
  joiningDate: string;
  employmentStatus: EmploymentStatus;
}

export interface PayrollRecord {
  id: string;
  employeeId: string;
  payrollMonth: string;
  academicYear: string;
  basicSalary: number;
  allowances: number;
  bonus: number;
  deductions: number;
  netSalary: number;
  amountPaid: number;
  remainingBalance: number;
  status: PayrollStatus;
  generatedAt: string;
}

export interface SalaryPayment {
  id: string;
  payrollId: string;
  employeeId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  paidAt: string;
  paidBy: string;
  notes?: string | null;
  status: "ACTIVE" | "REVERSED";
  isReversal: boolean;
  reversalReason?: string | null;
}

export interface SalaryAuditEntry {
  id: string;
  action: string;
  user: string;
  role: string;
  employee?: string;
  at: string;
  detail?: string;
}

export interface SalaryState {
  employees: Employee[];
  payroll: PayrollRecord[];
  payments: SalaryPayment[];
  audit: SalaryAuditEntry[];
  employeeSeq: number;
  activePayrollMonth: string;
  academicYear: string;
}

/**
 * What the salary dashboard shows.
 *
 * Every figure here answers a different question. The page used to carry
 * `payrollThisMonth` as well, which was assigned the same value as
 * `monthlyPayroll` — two cards, one number, and an administrator counting the
 * month twice. And `annualPayroll` summed every payroll row on record
 * regardless of year, so a school in its first term read its August total as
 * its annual wage bill.
 */
export interface SalaryDashboardSummary {
  /** Active people on payroll, and the split. */
  totalEmployees: number;
  totalTeachers: number;
  totalStaff: number;
  /** What the selected month costs in full. */
  monthlyPayroll: number;
  /** Of that, what has been handed over. */
  salariesPaid: number;
  /** And what has not — the number a school acts on. */
  outstanding: number;
  /** How many people are waiting, and how many are part paid. */
  pendingSalaries: number;
  partialPayments: number;
  /** Every payroll row on record, whatever the year. Named for what it is. */
  payrollAllTime: number;
}

export interface PayrollRow {
  payrollId: string;
  employeeId: string;
  employeeCode: string;
  employeeName: string;
  position: Position;
  type: EmployeeType;
  payrollMonth: string;
  netSalary: number;
  amountPaid: number;
  remainingBalance: number;
  status: PayrollStatus;
}

export interface PaySalaryInput {
  payrollId: string;
  amount: number;
  paymentMethod: PaymentMethod;
  notes?: string | null;
  paidBy?: string;
}
