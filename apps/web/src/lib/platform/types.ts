export type SchoolStatus = "ACTIVE" | "SUSPENDED";

export interface PlatformAdmin {
  adminId: string;
  username: string;
  name?: string;
}

export interface PlatformDashboard {
  totalSchools: number;
  activeSchools: number;
  suspendedSchools: number;
  totalStudents: number;
  totalTeachers: number;
  totalParents: number;
}

export interface PlatformSchool {
  id: string;
  name: string;
  subdomain: string;
  status: SchoolStatus;
  createdAt: string;
  userCount: number;
}

export interface CreateSchoolPayload {
  name: string;
  subdomain: string;
  adminUsername: string;
  adminPassword: string;
  adminName?: string;
}

export interface UpdateSchoolPayload {
  name?: string;
  status?: SchoolStatus;
}

export interface PlatformLoginResponse {
  accessToken: string;
  refreshToken: string;
  admin: { id: string; username: string; name?: string };
}
