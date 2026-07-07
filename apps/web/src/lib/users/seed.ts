import { getTeachersState } from "@/lib/teachers/store";
import { getState as getStudentsState } from "@/lib/students/store";
import {
  BUILT_IN_ROLES,
  builtInRolePermissions,
  hashPassword,
  roleLabel,
  userIdCode,
} from "./format";
import type { RoleDefinition, SystemUser, UsersState } from "./types";

function builtInRoles(): RoleDefinition[] {
  return BUILT_IN_ROLES.map((role) => ({
    id: role,
    name: role,
    label: roleLabel(role),
    description: `Built-in ${roleLabel(role)} role`,
    builtIn: true,
    permissions: builtInRolePermissions(role),
  }));
}

export function buildSeed(): UsersState {
  const now = new Date().toISOString();
  const teachers = getTeachersState().teachers;
  const { parents, students } = getStudentsState();
  const users: SystemUser[] = [];
  let seq = 0;

  function addUser(
    fullName: string,
    username: string,
    password: string,
    role: SystemUser["role"],
    status: SystemUser["status"] = "ACTIVE",
    links?: Partial<Pick<SystemUser, "linkedTeacherId" | "linkedParentId" | "linkedStudentId">>,
    lastLogin?: string | null,
  ) {
    seq += 1;
    users.push({
      id: `usr_${seq}`,
      userId: userIdCode(seq),
      fullName,
      username,
      passwordHash: hashPassword(password),
      role,
      status,
      lastLogin: lastLogin ?? (status === "ACTIVE" ? now : null),
      createdAt: now,
      updatedAt: now,
      ...links,
    });
  }

  addUser("Super Admin", "superadmin", "Admin@12345", "SUPER_ADMINISTRATOR");
  addUser("School Administrator", "admin", "Admin@12345", "ADMINISTRATOR");
  addUser("Ahmed Hassan", "ahmed.admin", "Admin@12345", "ADMINISTRATOR");
  addUser("Fatima Ali", "fatima.finance", "Finance@123", "FINANCE_OFFICER");
  addUser("Omar Yusuf", "omar.attendance", "Attend@123", "ATTENDANCE_OFFICER");
  addUser("Amina Mohamed", "amina.exams", "Exam@12345", "EXAM_MANAGER");
  addUser("Hassan Ibrahim", "hassan.reception", "Receive@123", "RECEPTION_OFFICER");
  addUser("Khadija Abdi", "khadija.academic", "Academic@123", "ACADEMIC_MANAGER");

  for (const t of teachers.slice(0, 20)) {
    addUser(
      t.fullName,
      t.username || t.code,
      t.password,
      "TEACHER",
      t.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      { linkedTeacherId: t.id },
      t.status === "ACTIVE" ? now : null,
    );
  }

  for (const p of parents.slice(0, 15)) {
    addUser(
      p.name,
      p.username || p.code,
      p.password,
      "PARENT",
      p.status === "ACTIVE" ? "ACTIVE" : "INACTIVE",
      { linkedParentId: p.id },
    );
  }

  for (const s of students.filter((st) => st.status === "ACTIVE").slice(0, 10)) {
    addUser(s.fullName, s.code, "Student@123", "STUDENT", "ACTIVE", {
      linkedStudentId: s.id,
    });
  }

  addUser("Locked Demo User", "locked.user", "Locked@123", "RECEPTION_OFFICER", "LOCKED", undefined, null);

  const sessions = users.slice(0, 5).map((u, i) => ({
    id: `sess_${i + 1}`,
    userId: u.id,
    loginAt: new Date(Date.now() - i * 3600000).toISOString(),
    logoutAt: i % 2 === 0 ? new Date(Date.now() - i * 1800000).toISOString() : null,
    lastActivity: new Date(Date.now() - i * 600000).toISOString(),
    device: i % 2 === 0 ? "Desktop" : "Tablet",
    browser: "Chrome 124",
    ipAddress: `192.168.1.${10 + i}`,
  }));

  return {
    users,
    roles: builtInRoles(),
    sessions,
    notifications: [
      {
        id: "n1",
        type: "USER_CREATED",
        message: "New teacher account provisioned for TSHMM000012",
        at: now,
        read: false,
      },
      {
        id: "n2",
        type: "ACCOUNT_LOCKED",
        message: "Account locked.user locked after failed login attempts",
        at: now,
        read: false,
      },
    ],
    audit: [
      {
        id: "ua1",
        action: "User Created",
        user: "Super Admin",
        role: "SUPER_ADMINISTRATOR",
        at: now,
        detail: "Seed data initialized",
      },
    ],
    security: {
      sessionTimeoutMinutes: 30,
      maxFailedLogins: 5,
      minPasswordLength: 8,
      requireUppercase: true,
      requireNumber: true,
    },
    userSeq: seq,
  };
}
