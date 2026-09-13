export type SchoolStatus = "ACTIVE" | "SUSPENDED";

export interface PlatformAdmin {
  adminId: string;
  username: string;
  name?: string;
  role?: "SUPER_ADMIN" | "OPERATOR";
}

export interface PlatformDashboard {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
  /** On a plan and still inside it. */
  subscribedSchools: number;
  /** Of those, with a fortnight or less left. */
  expiringSchools: number;
  /** Had a plan; it has run out. A renewal conversation. */
  expiredSchools: number;
  /** Never had one at all. A sales conversation. */
  unsubscribedSchools: number;
}

export interface PlatformSchool {
  id: string;
  name: string;
  subdomain: string;
  status: SchoolStatus;
  createdAt: string;
  /** Free-trial deadline; null when no trial was granted. */
  trialEndsAt: string | null;
  userCount: number;
}

export interface CreateSchoolPayload {
  name: string;
  subdomain: string;
  adminUsername: string;
  adminPassword: string;
  adminName?: string;
  /** Free-trial length in days. Omitted = server default (7). 0 = no trial. */
  trialDays?: number;
}

export interface UpdateSchoolPayload {
  name?: string;
  status?: SchoolStatus;
}

export interface PlatformLoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    username: string;
    name?: string;
    role?: "SUPER_ADMIN" | "OPERATOR";
  };
}
