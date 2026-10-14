"use client";

import { api } from "@/lib/api";
import type { AccountStatus, SystemRole, SystemUser } from "./types";

/** Raw user shape returned by the NestJS API (`/users`). */
interface ApiUser {
  id: string;
  schoolId: string;
  username: string;
  code: string | null;
  fullName: string | null;
  role: string;
  status: AccountStatus;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Map the API user onto the UI's richer `SystemUser` shape. */
export function mapApiUser(u: ApiUser): SystemUser {
  return {
    id: u.id,
    // Staff get a USR- code; teachers, parents and students sign in with
    // their own code (TCH0001, PAR0003) as the username, which is what the
    // school knows them by. The database id was meaningless on the list.
    userId: u.code ?? u.username,
    fullName: u.fullName ?? u.username,
    username: u.username,
    passwordHash: "",
    role: u.role as SystemRole,
    status: u.status,
    lastLogin: u.lastLoginAt,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
  };
}

export async function apiListUsers(): Promise<SystemUser[]> {
  const rows = await api<ApiUser[]>("/users");
  return rows.map(mapApiUser);
}

export async function apiCreateUser(input: {
  fullName: string;
  username: string;
  password: string;
  role: SystemRole;
  status?: AccountStatus;
}): Promise<SystemUser> {
  const row = await api<ApiUser>("/users", {
    method: "POST",
    body: {
      username: input.username,
      fullName: input.fullName,
      password: input.password,
      role: input.role,
      status: input.status,
    },
  });
  return mapApiUser(row);
}

export async function apiUpdateUser(
  id: string,
  patch: {
    fullName?: string;
    username?: string;
    role?: SystemRole;
    status?: AccountStatus;
  },
): Promise<SystemUser> {
  const row = await api<ApiUser>(`/users/${id}`, {
    method: "PATCH",
    body: patch,
  });
  return mapApiUser(row);
}

export async function apiResetPassword(
  id: string,
  newPassword: string,
): Promise<void> {
  await api(`/users/${id}/reset-password`, {
    method: "POST",
    body: { newPassword },
  });
}

export async function apiDeleteUser(id: string): Promise<void> {
  await api(`/users/${id}`, { method: "DELETE" });
}
