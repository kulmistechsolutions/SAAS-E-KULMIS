import { ACTIVE_ACADEMIC_YEAR } from "@/lib/students/constants";
import { getTeachersState } from "@/lib/teachers/store";
import { monthKey, netSalary } from "./format";
import type { Employee, PayrollRecord, SalaryState } from "./types";

const STAFF_SEED: Omit<Employee, "id">[] = [
  {
    code: "STAFF000001",
    fullName: "Ahmed Hassan",
    type: "STAFF",
    position: "Administrator",
    basicSalary: 650,
    allowances: 50,
    deductions: 0,
    bonus: 0,
    paymentMethod: "BANK_TRANSFER",
    joiningDate: "2022-09-01",
    employmentStatus: "ACTIVE",
  },
  {
    code: "STAFF000002",
    fullName: "Fatima Ali",
    type: "STAFF",
    position: "Finance Officer",
    basicSalary: 550,
    allowances: 40,
    deductions: 0,
    bonus: 25,
    paymentMethod: "BANK_TRANSFER",
    joiningDate: "2023-01-15",
    employmentStatus: "ACTIVE",
  },
  {
    code: "STAFF000003",
    fullName: "Omar Yusuf",
    type: "STAFF",
    position: "Attendance Officer",
    basicSalary: 420,
    allowances: 30,
    deductions: 10,
    bonus: 0,
    paymentMethod: "MOBILE_MONEY",
    joiningDate: "2023-06-01",
    employmentStatus: "ACTIVE",
  },
  {
    code: "STAFF000004",
    fullName: "Amina Mohamed",
    type: "STAFF",
    position: "Receptionist",
    basicSalary: 380,
    allowances: 20,
    deductions: 0,
    bonus: 0,
    paymentMethod: "CASH",
    joiningDate: "2024-02-01",
    employmentStatus: "ACTIVE",
  },
  {
    code: "STAFF000005",
    fullName: "Hassan Ibrahim",
    type: "STAFF",
    position: "Security Staff",
    basicSalary: 350,
    allowances: 15,
    deductions: 0,
    bonus: 0,
    paymentMethod: "CASH",
    joiningDate: "2021-08-01",
    employmentStatus: "ACTIVE",
  },
  {
    code: "STAFF000006",
    fullName: "Khadija Abdi",
    type: "STAFF",
    position: "Cleaner",
    basicSalary: 300,
    allowances: 10,
    deductions: 0,
    bonus: 0,
    paymentMethod: "CASH",
    joiningDate: "2022-03-01",
    employmentStatus: "ACTIVE",
  },
];

function buildPayrollForMonth(
  employees: Employee[],
  payrollMonth: string,
  academicYear: string,
  paidRatio: number,
): PayrollRecord[] {
  const records: PayrollRecord[] = [];
  let i = 0;
  for (const emp of employees) {
    if (emp.employmentStatus !== "ACTIVE") continue;
    i += 1;
    const ns = netSalary(emp.basicSalary, emp.allowances, emp.bonus, emp.deductions);
    const seed = (emp.code.charCodeAt(emp.code.length - 1) + payrollMonth.charCodeAt(5)) % 10;
    let amountPaid = 0;
    let status: PayrollRecord["status"] = "PENDING";
    if (seed / 10 < paidRatio) {
      amountPaid = ns;
      status = "PAID";
    } else if (seed / 10 < paidRatio + 0.12) {
      amountPaid = Math.round(ns * 0.5);
      status = "PARTIAL";
    }
    records.push({
      id: `pay_${payrollMonth}_${i}`,
      employeeId: emp.id,
      payrollMonth,
      academicYear,
      basicSalary: emp.basicSalary,
      allowances: emp.allowances,
      bonus: emp.bonus,
      deductions: emp.deductions,
      netSalary: ns,
      amountPaid,
      remainingBalance: Math.max(0, ns - amountPaid),
      status,
      generatedAt: `${payrollMonth}-01T08:00:00.000Z`,
    });
  }
  return records;
}

export function buildSeed(): SalaryState {
  const tt = getTeachersState();
  const academicYear = ACTIVE_ACADEMIC_YEAR;
  const currentMonth = monthKey();

  const teacherEmployees: Employee[] = tt.teachers.map((t, i) => ({
    id: `emp_t_${t.id}`,
    code: t.code,
    fullName: t.fullName,
    type: "TEACHER" as const,
    teacherId: t.id,
    position: "Teacher" as const,
    basicSalary: t.salary,
    allowances: i % 3 === 0 ? 30 : 0,
    deductions: i % 5 === 0 ? 15 : 0,
    bonus: i % 7 === 0 ? 20 : 0,
    paymentMethod: "BANK_TRANSFER" as const,
    joiningDate: t.registrationDate,
    employmentStatus: t.status,
  }));

  const staffEmployees: Employee[] = STAFF_SEED.map((s, i) => ({
    ...s,
    id: `emp_s_${i + 1}`,
  }));

  const employees = [...teacherEmployees, ...staffEmployees];

  const prev = new Date();
  prev.setMonth(prev.getMonth() - 1);
  const prevMonth = monthKey(prev);

  const payroll = [
    ...buildPayrollForMonth(employees, prevMonth, academicYear, 0.92),
    ...buildPayrollForMonth(employees, currentMonth, academicYear, 0.35),
  ];

  return {
    employees,
    payroll,
    payments: [],
    audit: [
      {
        id: "sal_1",
        action: "Salary Generated",
        user: "Admin User",
        role: "ADMINISTRATOR",
        at: new Date().toISOString(),
        detail: `Payroll ${currentMonth}`,
      },
    ],
    employeeSeq: staffEmployees.length,
    activePayrollMonth: currentMonth,
    academicYear,
  };
}
