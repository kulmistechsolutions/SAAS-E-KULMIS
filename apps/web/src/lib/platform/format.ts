import type { SchoolStatus } from "./types";

export function schoolStatusLabel(status: SchoolStatus): string {
  return status === "ACTIVE" ? "Active" : "Suspended";
}

export function shortDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function tenantUrl(subdomain: string): string {
  const root = process.env.NEXT_PUBLIC_APP_ROOT_DOMAIN ?? "ekulmis.local";
  if (typeof window !== "undefined" && window.location.hostname === "localhost") {
    return `http://localhost:3000/login?tenant=${subdomain}`;
  }
  return `https://${subdomain}.${root}`;
}
