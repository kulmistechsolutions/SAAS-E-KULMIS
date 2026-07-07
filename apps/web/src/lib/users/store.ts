"use client";

import { useSyncExternalStore } from "react";
import { buildSeed } from "./seed";
import {
  builtInRolePermissions,
  hashPassword,
  roleLabel,
  userIdCode,
  verifyPassword,
} from "./format";
import type {
  AccountStatus,
  CreateUserInput,
  PermissionAction,
  PermissionMap,
  PermissionModule,
  SecuritySettings,
  SystemRole,
  SystemUser,
  UpdateUserInput,
  UserRow,
  UsersDashboardSummary,
  UsersState,
} from "./types";

const KEY = "ekulmis_users_v1";

const EMPTY: UsersState = {
  users: [],
  roles: [],
  sessions: [],
  notifications: [],
  audit: [],
  security: {
    sessionTimeoutMinutes: 30,
    maxFailedLogins: 5,
    minPasswordLength: 8,
    requireUppercase: true,
    requireNumber: true,
  },
  userSeq: 0,
};

let state: UsersState | null = null;
const listeners = new Set<() => void>();

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emit() {
  listeners.forEach((l) => l());
}

function ensure(): UsersState {
  if (state) return state;
  if (typeof window === "undefined") return EMPTY;
  const raw = localStorage.getItem(KEY);
  if (raw) {
    try {
      state = JSON.parse(raw) as UsersState;
      return state;
    } catch {
      /* fall through */
    }
  }
  state = buildSeed();
  localStorage.setItem(KEY, JSON.stringify(state));
  return state;
}

function setState(next: UsersState) {
  state = next;
  if (typeof window !== "undefined") {
    localStorage.setItem(KEY, JSON.stringify(next));
  }
  emit();
}

export function getUsersState(): UsersState {
  return ensure();
}

export function useUsersState(): UsersState {
  return useSyncExternalStore(subscribe, getUsersState, () => EMPTY);
}

export function resetUsers() {
  setState(buildSeed());
}

function logAudit(
  action: string,
  targetUser?: string,
  detail?: string,
  user = "Admin User",
  role = "ADMINISTRATOR",
) {
  const s = ensure();
  setState({
    ...s,
    audit: [
      {
        id: `ua_${Date.now()}`,
        action,
        user,
        role,
        targetUser,
        at: new Date().toISOString(),
        detail,
        ipAddress: "127.0.0.1",
        device: "Desktop",
        browser: "Chrome",
      },
      ...s.audit,
    ].slice(0, 400),
  });
}

function pushNotification(type: string, message: string) {
  const s = ensure();
  setState({
    ...ensure(),
    notifications: [
      { id: `n_${Date.now()}`, type, message, at: new Date().toISOString(), read: false },
      ...s.notifications,
    ].slice(0, 50),
  });
}

export function validatePassword(password: string): string | null {
  const sec = ensure().security;
  if (!password || password.length < sec.minPasswordLength) {
    return `Password must be at least ${sec.minPasswordLength} characters.`;
  }
  if (sec.requireUppercase && !/[A-Z]/.test(password)) {
    return "Password must include an uppercase letter.";
  }
  if (sec.requireNumber && !/[0-9]/.test(password)) {
    return "Password must include a number.";
  }
  return null;
}

export function getUser(id: string): SystemUser | undefined {
  return ensure().users.find(
    (u) => u.id === id || u.userId === id || u.username === id,
  );
}

export function getRole(id: string) {
  return ensure().roles.find((r) => r.id === id || r.name === id);
}

export function canAccess(
  role: SystemRole,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  const s = ensure();
  const def = s.roles.find((r) => r.name === role || r.id === role);
  if (!def) return false;
  return !!def.permissions[module]?.[action];
}

export function dashboardSummary(): UsersDashboardSummary {
  const users = ensure().users;
  const count = (role: SystemRole | SystemRole[]) => {
    const roles = Array.isArray(role) ? role : [role];
    return users.filter((u) => roles.includes(u.role)).length;
  };
  return {
    totalUsers: users.length,
    activeUsers: users.filter((u) => u.status === "ACTIVE").length,
    inactiveUsers: users.filter((u) => u.status === "INACTIVE").length,
    administrators: count(["SUPER_ADMINISTRATOR", "ADMINISTRATOR"]),
    teachers: count("TEACHER"),
    parents: count("PARENT"),
    financeOfficers: count("FINANCE_OFFICER"),
    attendanceOfficers: count("ATTENDANCE_OFFICER"),
    examManagers: count("EXAM_MANAGER"),
    receptionOfficers: count("RECEPTION_OFFICER"),
  };
}

export function listUsers(opts?: {
  search?: string;
  role?: string;
  status?: AccountStatus;
}): UserRow[] {
  const q = opts?.search?.trim().toLowerCase() ?? "";
  let users = ensure().users;

  if (opts?.role) users = users.filter((u) => u.role === opts.role);
  if (opts?.status) users = users.filter((u) => u.status === opts.status);

  const rows = users
    .filter((u) => {
      if (!q) return true;
      const hay = `${u.userId} ${u.username} ${u.fullName} ${u.role}`.toLowerCase();
      return hay.includes(q);
    })
    .sort((a, b) => a.fullName.localeCompare(b.fullName))
    .map((u, i) => ({
      serial: i + 1,
      id: u.id,
      userId: u.userId,
      fullName: u.fullName,
      username: u.username,
      role: u.role,
      roleLabel: roleLabel(u.role),
      status: u.status,
      lastLogin: u.lastLogin,
    }));

  return rows;
}

export function sessionsForUser(userId: string) {
  return ensure()
    .sessions.filter((s) => s.userId === userId)
    .sort((a, b) => b.loginAt.localeCompare(a.loginAt));
}

export function createUser(
  input: CreateUserInput,
): { ok: boolean; error?: string; user?: SystemUser } {
  const s = ensure();
  const username = input.username.trim();
  if (!input.fullName.trim()) return { ok: false, error: "Full name is required." };
  if (!username) return { ok: false, error: "Username is required." };
  if (s.users.some((u) => u.username.toLowerCase() === username.toLowerCase())) {
    return { ok: false, error: "Username already exists." };
  }
  const pwErr = validatePassword(input.password);
  if (pwErr) return { ok: false, error: pwErr };

  const seq = s.userSeq + 1;
  const now = new Date().toISOString();
  const user: SystemUser = {
    id: `usr_${Date.now()}`,
    userId: userIdCode(seq),
    fullName: input.fullName.trim(),
    username,
    passwordHash: hashPassword(input.password),
    role: input.role,
    status: input.status ?? "ACTIVE",
    lastLogin: null,
    createdAt: now,
    updatedAt: now,
  };

  setState({ ...ensure(), users: [user, ...s.users], userSeq: seq });
  logAudit("User Created", user.fullName, user.username);
  pushNotification("USER_CREATED", `New user ${user.username} created`);
  return { ok: true, user };
}

export function updateUser(
  input: UpdateUserInput,
): { ok: boolean; error?: string; user?: SystemUser } {
  const s = ensure();
  const existing = s.users.find((u) => u.id === input.id);
  if (!existing) return { ok: false, error: "User not found." };

  if (
    existing.role === "SUPER_ADMINISTRATOR" &&
    input.role &&
    input.role !== "SUPER_ADMINISTRATOR"
  ) {
    const supers = s.users.filter((u) => u.role === "SUPER_ADMINISTRATOR");
    if (supers.length <= 1) {
      return { ok: false, error: "Cannot change role of the last Super Administrator." };
    }
  }

  if (input.username) {
    const username = input.username.trim();
    if (
      s.users.some(
        (u) => u.id !== existing.id && u.username.toLowerCase() === username.toLowerCase(),
      )
    ) {
      return { ok: false, error: "Username already exists." };
    }
  }

  const updated: SystemUser = {
    ...existing,
    fullName: input.fullName?.trim() ?? existing.fullName,
    username: input.username?.trim() ?? existing.username,
    role: input.role ?? existing.role,
    status: input.status ?? existing.status,
    updatedAt: new Date().toISOString(),
  };

  setState({
    ...ensure(),
    users: s.users.map((u) => (u.id === existing.id ? updated : u)),
  });

  if (input.role && input.role !== existing.role) {
    logAudit("Role Changed", updated.fullName, `${existing.role} → ${input.role}`);
    pushNotification("ROLE_UPDATED", `Role updated for ${updated.username}`);
  } else {
    logAudit("User Updated", updated.fullName);
  }
  return { ok: true, user: updated };
}

export function resetPassword(
  userId: string,
  newPassword: string,
): { ok: boolean; error?: string } {
  const pwErr = validatePassword(newPassword);
  if (pwErr) return { ok: false, error: pwErr };
  const s = ensure();
  const user = s.users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "User not found." };

  setState({
    ...ensure(),
    users: s.users.map((u) =>
      u.id === userId
        ? {
            ...u,
            passwordHash: hashPassword(newPassword),
            forcePasswordChange: true,
            updatedAt: new Date().toISOString(),
          }
        : u,
    ),
  });
  logAudit("Password Reset", user.fullName);
  pushNotification("PASSWORD_RESET", `Password reset for ${user.username}`);
  return { ok: true };
}

export function setAccountStatus(
  userId: string,
  status: AccountStatus,
): { ok: boolean; error?: string } {
  const s = ensure();
  const user = s.users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "User not found." };

  if (user.role === "SUPER_ADMINISTRATOR" && status !== "ACTIVE") {
    const activeSupers = s.users.filter(
      (u) => u.role === "SUPER_ADMINISTRATOR" && u.status === "ACTIVE" && u.id !== userId,
    );
    if (activeSupers.length === 0) {
      return { ok: false, error: "Cannot deactivate the last Super Administrator." };
    }
  }

  setState({
    ...ensure(),
    users: s.users.map((u) =>
      u.id === userId ? { ...u, status, updatedAt: new Date().toISOString() } : u,
    ),
  });

  const action =
    status === "LOCKED"
      ? "Account Locked"
      : status === "ACTIVE"
        ? "Account Unlocked"
        : "User Updated";
  logAudit(action, user.fullName, status);
  if (status === "LOCKED") {
    pushNotification("ACCOUNT_LOCKED", `Account ${user.username} locked`);
  }
  return { ok: true };
}

export function deleteUser(userId: string): { ok: boolean; error?: string } {
  const s = ensure();
  const user = s.users.find((u) => u.id === userId);
  if (!user) return { ok: false, error: "User not found." };
  if (user.role === "SUPER_ADMINISTRATOR") {
    const supers = s.users.filter((u) => u.role === "SUPER_ADMINISTRATOR");
    if (supers.length <= 1) {
      return { ok: false, error: "Cannot delete the last Super Administrator." };
    }
  }
  setState({
    ...ensure(),
    users: s.users.filter((u) => u.id !== userId),
  });
  logAudit("User Deleted", user.fullName, user.username);
  return { ok: true };
}

export function updateRolePermissions(
  roleId: string,
  permissions: PermissionMap,
): { ok: boolean; error?: string } {
  const s = ensure();
  const role = s.roles.find((r) => r.id === roleId);
  if (!role) return { ok: false, error: "Role not found." };
  if (role.builtIn && role.name === "SUPER_ADMINISTRATOR") {
    return { ok: false, error: "Super Administrator permissions cannot be modified." };
  }

  setState({
    ...ensure(),
    roles: s.roles.map((r) => (r.id === roleId ? { ...r, permissions } : r)),
  });
  logAudit("Permission Updated", role.label);
  return { ok: true };
}

export function createCustomRole(
  name: string,
  description?: string,
): { ok: boolean; error?: string; roleId?: string } {
  const label = name.trim();
  if (!label) return { ok: false, error: "Role name is required." };
  const id = label.toUpperCase().replace(/\s+/g, "_");
  const s = ensure();
  if (s.roles.some((r) => r.id === id || r.label.toLowerCase() === label.toLowerCase())) {
    return { ok: false, error: "Role already exists." };
  }
  const role = {
    id,
    name: id,
    label,
    description: description ?? `Custom role: ${label}`,
    builtIn: false,
    permissions: builtInRolePermissions("RECEPTION_OFFICER"),
  };
  setState({ ...ensure(), roles: [...s.roles, role] });
  return { ok: true, roleId: id };
}

export function updateSecuritySettings(
  settings: Partial<SecuritySettings>,
): { ok: boolean } {
  const s = ensure();
  setState({ ...ensure(), security: { ...s.security, ...settings } });
  return { ok: true };
}

export function authenticateLocal(
  username: string,
  password: string,
): { ok: boolean; error?: string; user?: SystemUser } {
  const s = ensure();
  const user = s.users.find(
    (u) => u.username.toLowerCase() === username.trim().toLowerCase(),
  );
  if (!user) return { ok: false, error: "Invalid username or password." };
  if (user.status === "INACTIVE") {
    return { ok: false, error: "Account is inactive. Contact administrator." };
  }
  if (user.status === "LOCKED") {
    return { ok: false, error: "Account is locked. Administrator approval required." };
  }
  if (!verifyPassword(password, user.passwordHash)) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1;
    const locked = attempts >= s.security.maxFailedLogins;
    setState({
      ...ensure(),
      users: s.users.map((u) =>
        u.id === user.id
          ? {
              ...u,
              failedLoginAttempts: attempts,
              status: locked ? "LOCKED" : u.status,
              updatedAt: new Date().toISOString(),
            }
          : u,
      ),
    });
    if (locked) {
      pushNotification("ACCOUNT_LOCKED", `${user.username} locked after failed attempts`);
      logAudit("Account Locked", user.fullName, "Failed login threshold");
    }
    return { ok: false, error: locked ? "Account locked." : "Invalid username or password." };
  }

  const now = new Date().toISOString();
  setState({
    ...ensure(),
    users: s.users.map((u) =>
      u.id === user.id
        ? { ...u, lastLogin: now, failedLoginAttempts: 0, updatedAt: now }
        : u,
    ),
    sessions: [
      {
        id: `sess_${Date.now()}`,
        userId: user.id,
        loginAt: now,
        logoutAt: null,
        lastActivity: now,
        device: "Desktop",
        browser: typeof navigator !== "undefined" ? navigator.userAgent.slice(0, 40) : "Browser",
        ipAddress: "127.0.0.1",
      },
      ...s.sessions,
    ].slice(0, 200),
  });
  logAudit("Login", user.fullName, user.username);
  return { ok: true, user };
}

export function exportUsersCsv(rows: UserRow[]) {
  const header = "User ID,Full Name,Username,Role,Status,Last Login\n";
  const body = rows
    .map((r) =>
      [r.userId, `"${r.fullName}"`, r.username, r.roleLabel, r.status, r.lastLogin ?? ""].join(
        ",",
      ),
    )
    .join("\n");
  const blob = new Blob([header + body], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "users.csv";
  a.click();
  URL.revokeObjectURL(url);
  logAudit("User Exported", undefined, `${rows.length} users`);
}
