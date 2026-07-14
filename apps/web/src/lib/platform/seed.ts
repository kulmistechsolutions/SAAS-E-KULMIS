import type { PlatformDashboard, PlatformSchool } from "./types";

export function buildPlatformSeed(): PlatformSchool[] {
  const now = Date.now();
  return [
    {
      id: "sch_demo",
      name: "Demo Academy",
      subdomain: "demo",
      status: "ACTIVE",
      createdAt: new Date(now - 90 * 86400000).toISOString(),
      userCount: 12,
    },
    {
      id: "sch_alnoor",
      name: "Al-Noor International School",
      subdomain: "alnoor",
      status: "ACTIVE",
      createdAt: new Date(now - 60 * 86400000).toISOString(),
      userCount: 8,
    },
    {
      id: "sch_hope",
      name: "Hope Primary School",
      subdomain: "hope",
      status: "SUSPENDED",
      createdAt: new Date(now - 120 * 86400000).toISOString(),
      userCount: 3,
    },
  ];
}

export function previewDashboard(schools: PlatformSchool[]): PlatformDashboard {
  const active = schools.filter((s) => s.status === "ACTIVE").length;
  const suspended = schools.filter((s) => s.status === "SUSPENDED").length;
  return {
    totalSchools: schools.length,
    activeSchools: active,
    suspendedSchools: suspended,
    totalStudents: schools.length * 420,
    totalTeachers: schools.length * 28,
    totalParents: schools.length * 380,
  };
}
