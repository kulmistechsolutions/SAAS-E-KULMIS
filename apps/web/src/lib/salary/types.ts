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

export interface SalaryDashboardSummary {
  totalEmployees: number;
  totalTeachers: number;
  totalStaff: number;
  monthlyPayroll: number;
  salariesPaid: number;
  pendingSalaries: number;
  partialPayments: number;
  payrollThisMonth: number;
  annualPayroll: number;
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
