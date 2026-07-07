import { PARENT_PREFIX, code, generatePassword } from "./constants";
import type { Parent, ParentStatus } from "./types";

export function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0] ?? "parent";
  return part.replace(/[^a-zA-Z0-9]/g, "") || "parent";
}

/** Username: first name, then firstName+suffix, then firstName+id fragment. */
export function deriveUsername(
  fullName: string,
  parentCode: string,
  taken: string[],
): string {
  const base = firstName(fullName);
  const lower = new Set(taken.map((u) => u.toLowerCase()));
  if (!lower.has(base.toLowerCase())) return base;
  const num = parentCode.replace(/\D/g, "").slice(-3) || "001";
  const cand = `${base}${num}`;
  if (!lower.has(cand.toLowerCase())) return cand;
  const suffix = parentCode.replace(/[^A-Z0-9]/gi, "").slice(-5);
  return `${base}${suffix}`;
}

export function buildParent(
  name: string,
  phone: string,
  seq: number,
  takenUsernames: string[],
  opts?: {
    id?: string;
    registrationDate?: string;
    altPhone?: string | null;
    email?: string | null;
    address?: string | null;
    occupation?: string | null;
    status?: ParentStatus;
  },
): Parent {
  const parentCode = code(PARENT_PREFIX, seq);
  return {
    id: opts?.id ?? `p_${seq}`,
    code: parentCode,
    name: name.trim(),
    phone: phone.trim(),
    altPhone: opts?.altPhone ?? null,
    email: opts?.email ?? null,
    address: opts?.address ?? null,
    occupation: opts?.occupation ?? null,
    registrationDate: opts?.registrationDate ?? new Date().toISOString(),
    status: opts?.status ?? "ACTIVE",
    username: deriveUsername(name, parentCode, takenUsernames),
    password: generatePassword(),
  };
}

/** Upgrade legacy parent records missing new fields. */
export function migrateParent(p: Partial<Parent>, seq: number, taken: string[]): Parent {
  const parentCode = p.code ?? code(PARENT_PREFIX, seq);
  const name = p.name ?? "Unknown";
  return {
    id: p.id ?? `p_${seq}`,
    code: parentCode,
    name,
    phone: p.phone ?? "",
    altPhone: p.altPhone ?? null,
    email: p.email ?? null,
    address: p.address ?? null,
    occupation: p.occupation ?? null,
    registrationDate: p.registrationDate ?? new Date().toISOString(),
    status: p.status ?? "ACTIVE",
    username: p.username ?? deriveUsername(name, parentCode, taken),
    password: p.password ?? generatePassword(),
  };
}
