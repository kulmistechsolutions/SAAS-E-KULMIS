export type EmploymentStatus = "ACTIVE" | "INACTIVE";

/** A registered non-teaching staff member — guard, cleaner, and similar roles. */
export interface StaffEmployee {
  id: string;
  code: string;
  fullName: string;
  position: string;
  phone: string | null;
  salary: number;
  status: EmploymentStatus;
  notes: string | null;
  createdAt: string;
}

export interface StaffEmployeeInput {
  fullName: string;
  position: string;
  phone?: string | null;
  salary?: number;
  status?: EmploymentStatus;
  notes?: string | null;
}

export interface EmployeesState {
  employees: StaffEmployee[];
}
