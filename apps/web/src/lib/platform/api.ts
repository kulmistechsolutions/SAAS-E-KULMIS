import type {
  CreateSchoolPayload,
  PlatformDashboard,
  PlatformLoginResponse,
  PlatformSchool,
  PlatformAdmin,
  UpdateSchoolPayload,
} from "./types";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const ACCESS_KEY = "ekulmis_platform_access_token";
const REFRESH_KEY = "ekulmis_platform_refresh_token";

export class PlatformApiError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export function getPlatformAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

export function setPlatformTokens(access: string | null, refresh?: string | null) {
  if (typeof window === "undefined") return;
  if (access) window.localStorage.setItem(ACCESS_KEY, access);
  else window.localStorage.removeItem(ACCESS_KEY);
  if (refresh !== undefined) {
    if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
    else window.localStorage.removeItem(REFRESH_KEY);
  }
}

export function getPlatformRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

async function platformFetch<T>(
  path: string,
  opts: { method?: string; body?: unknown; auth?: boolean } = {},
): Promise<T> {
  const token = getPlatformAccessToken();
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== false && token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_URL}/api${path}`, {
    method: opts.method ?? "GET",
    headers,
    body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
  });

  if (!res.ok) {
    let message = res.statusText;
    try {
      const data = (await res.json()) as { message?: string | string[] };
      if (data.message) {
        message = Array.isArray(data.message) ? data.message.join(", ") : data.message;
      }
    } catch {
      /* keep statusText */
    }
    if (res.status === 401 && typeof window !== "undefined") {
      setPlatformTokens(null, null);
    }
    throw new PlatformApiError(res.status, message);
  }

  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

type ApiSchool = {
  id: string;
  name: string;
  subdomain: string;
  status: "ACTIVE" | "SUSPENDED";
  createdAt: string;
  _count?: { users: number };
};

function mapSchool(row: ApiSchool): PlatformSchool {
  return {
    id: row.id,
    name: row.name,
    subdomain: row.subdomain,
    status: row.status,
    createdAt: row.createdAt,
    userCount: row._count?.users ?? 0,
  };
}

export async function platformLogin(
  identifier: string,
  password: string,
): Promise<PlatformLoginResponse> {
  return platformFetch<PlatformLoginResponse>("/platform/auth/login", {
    method: "POST",
    body: { identifier, password },
    auth: false,
  });
}

export async function platformLogout(): Promise<void> {
  const refresh = getPlatformRefreshToken();
  try {
    await platformFetch("/platform/auth/logout", {
      method: "POST",
      body: { refreshToken: refresh },
      auth: false,
    });
  } catch {
    /* ignore */
  }
  setPlatformTokens(null, null);
}

export async function platformMe(): Promise<PlatformAdmin> {
  const me = await platformFetch<{
    adminId: string;
    username: string;
    name?: string;
    role?: "SUPER_ADMIN" | "OPERATOR";
  }>("/platform/auth/me");
  return {
    adminId: me.adminId,
    username: me.username,
    name: me.name,
    role: me.role === "OPERATOR" ? "OPERATOR" : "SUPER_ADMIN",
  };
}

export async function fetchPlatformDashboard(): Promise<PlatformDashboard> {
  return platformFetch<PlatformDashboard>("/platform/dashboard");
}

// ── AI (OpenAI) config for quiz auto-grading ──
export interface PlatformAiConfig {
  enabled: boolean;
  provider: string;
  model: string;
  hasKey: boolean;
  keyHint: string | null;
  connectionStatus: string;
  connectionMessage: string | null;
  lastTestedAt: string | null;
}

export const fetchPlatformAiConfig = () =>
  platformFetch<PlatformAiConfig>("/platform/ai/config");

export const updatePlatformAiConfig = (body: {
  enabled?: boolean;
  apiKey?: string;
  model?: string;
}) =>
  platformFetch<PlatformAiConfig>("/platform/ai/config", {
    method: "PATCH",
    body,
  });

export const testPlatformAiConnection = () =>
  platformFetch<{ ok: boolean; message: string }>("/platform/ai/test", {
    method: "POST",
  });

export async function fetchPlatformSchools(): Promise<PlatformSchool[]> {
  const rows = await platformFetch<ApiSchool[]>("/platform/schools");
  return rows.map(mapSchool);
}

export async function fetchPlatformSchool(id: string): Promise<PlatformSchool> {
  const row = await platformFetch<ApiSchool>(`/platform/schools/${id}`);
  return mapSchool(row);
}

export async function createPlatformSchool(
  payload: CreateSchoolPayload,
): Promise<{ school: PlatformSchool; admin: { username: string } }> {
  const res = await platformFetch<{
    school: ApiSchool;
    admin: { username: string };
  }>("/platform/schools", { method: "POST", body: payload });
  return { school: mapSchool(res.school), admin: res.admin };
}

export async function updatePlatformSchool(
  id: string,
  payload: UpdateSchoolPayload,
): Promise<PlatformSchool> {
  const row = await platformFetch<ApiSchool>(`/platform/schools/${id}`, {
    method: "PATCH",
    body: payload,
  });
  return mapSchool(row);
}

export async function deletePlatformSchool(id: string): Promise<void> {
  await platformFetch(`/platform/schools/${id}`, { method: "DELETE" });
}

// ── School logins (Super Admin password recovery) ───────────────────────────

export interface PlatformSchoolUser {
  id: string;
  username: string;
  role: string;
  status: string;
  lastLoginAt: string | null;
  createdAt: string;
}

export const fetchPlatformSchoolUsers = (schoolId: string) =>
  platformFetch<{
    school: { id: string; name: string };
    users: PlatformSchoolUser[];
  }>(`/platform/schools/${schoolId}/users`);

export const resetPlatformSchoolUserPassword = (
  schoolId: string,
  userId: string,
  newPassword: string,
) =>
  platformFetch<{ success: boolean; username: string; role: string }>(
    `/platform/schools/${schoolId}/users/${userId}/reset-password`,
    { method: "POST", body: { newPassword } },
  );

// ── Platform SMS ────────────────────────────────────────────────────────────

export interface PlatformSmsConfig {
  id: string;
  enabled: boolean;
  baseUrl: string;
  username: string;
  hasPassword: boolean;
  defaultSenderId: string | null;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "ERROR";
  connectionMessage: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  providerBalance: string | null;
  connectionVerified: boolean;
  packagesUnlocked: boolean;
  updatedAt: string;
}

export interface PlatformSmsConnectionStep {
  step: string;
  ok: boolean;
  durationMs: number;
  httpStatus?: number;
  message: string;
  detail?: unknown;
}

export interface PlatformSmsConnectionTest {
  ok: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
  providerBalance?: string;
  tokenExpiresIn?: number;
  steps: PlatformSmsConnectionStep[];
  testedAt: string;
}

export interface PlatformSmsConnectionLog {
  id: string;
  action: string;
  success: boolean;
  status: string;
  message: string;
  details: unknown;
  adminId: string | null;
  createdAt: string;
}

export interface PlatformSmsPackage {
  id: string;
  name: string;
  description: string | null;
  credits: number;
  price: string | number;
  currency: string;
  isActive: boolean;
  sortOrder: number;
}

export interface PlatformSmsOverview {
  config: PlatformSmsConfig;
  packages: PlatformSmsPackage[];
  recentPurchases: {
    id: string;
    creditsTotal: number;
    creditsRemaining: number;
    amountPaid: string | number;
    purchasedAt: string;
    school: { id: string; name: string; subdomain: string };
    package: { name: string };
  }[];
  deliveryStats: { status: string; count: number; credits: number }[];
  schools: {
    id: string;
    name: string;
    subdomain: string;
    smsEnabled: boolean;
    smsSenderName: string | null;
    status: string;
    creditsRemaining: number;
  }[];
}

export async function fetchPlatformSmsOverview() {
  return platformFetch<PlatformSmsOverview>("/platform/sms/overview");
}

export async function fetchPlatformSmsConfig() {
  return platformFetch<PlatformSmsConfig>("/platform/sms/config");
}

export async function testPlatformSmsConnection(body: {
  baseUrl?: string;
  username?: string;
  password?: string;
  saveOnSuccess?: boolean;
  enabled?: boolean;
  defaultSenderId?: string | null;
}) {
  return platformFetch<{
    config: PlatformSmsConfig;
    test: PlatformSmsConnectionTest;
  }>("/platform/sms/test-connection", { method: "POST", body });
}

export async function fetchPlatformSmsConnectionLogs(take = 50) {
  return platformFetch<PlatformSmsConnectionLog[]>(
    `/platform/sms/connection-logs?take=${take}`,
  );
}

export async function updatePlatformSmsConfig(body: {
  enabled?: boolean;
  defaultSenderId?: string | null;
}) {
  return platformFetch<PlatformSmsConfig>("/platform/sms/config", {
    method: "PATCH",
    body,
  });
}

export async function fetchPlatformSmsPackages() {
  return platformFetch<PlatformSmsPackage[]>("/platform/sms/packages");
}

export async function createPlatformSmsPackage(body: {
  name: string;
  description?: string;
  credits: number;
  price: number;
  currency?: string;
}) {
  return platformFetch<PlatformSmsPackage>("/platform/sms/packages", {
    method: "POST",
    body,
  });
}

export async function updatePlatformSmsPackage(
  id: string,
  body: Partial<{
    name: string;
    description: string | null;
    credits: number;
    price: number;
    currency: string;
    isActive: boolean;
  }>,
) {
  return platformFetch<PlatformSmsPackage>(`/platform/sms/packages/${id}`, {
    method: "PATCH",
    body,
  });
}

export async function setPlatformSmsPackageActive(id: string, active: boolean) {
  return platformFetch(
    `/platform/sms/packages/${id}/${active ? "activate" : "deactivate"}`,
    { method: "POST" },
  );
}

export async function assignPlatformSmsPackage(body: {
  schoolId: string;
  packageId: string;
  note?: string;
}) {
  return platformFetch("/platform/sms/assign", { method: "POST", body });
}

// ── Own-gateway licences (paid add-on sold to schools) ──

export interface PlatformSmsGatewayLicense {
  id: string;
  schoolId: string;
  startDate: string;
  endDate: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  durationMonths: number;
  price: string | number | null;
  currency: string;
  note: string | null;
  createdAt: string;
  school: { id: string; name: string; subdomain: string };
}

export const fetchPlatformSmsGatewayLicenses = () =>
  platformFetch<PlatformSmsGatewayLicense[]>("/platform/sms/gateway-licenses");

export const grantPlatformSmsGatewayLicense = (body: {
  schoolId: string;
  durationMonths: number;
  price?: number | null;
  currency?: string;
  note?: string | null;
}) =>
  platformFetch<PlatformSmsGatewayLicense>("/platform/sms/gateway-licenses", {
    method: "POST",
    body,
  });

export const revokePlatformSmsGatewayLicense = (id: string) =>
  platformFetch<PlatformSmsGatewayLicense>(
    `/platform/sms/gateway-licenses/${id}`,
    { method: "DELETE" },
  );

export async function fetchPlatformSmsMessages(params?: {
  schoolId?: string;
  status?: string;
  q?: string;
}) {
  const qs = new URLSearchParams();
  if (params?.schoolId) qs.set("schoolId", params.schoolId);
  if (params?.status) qs.set("status", params.status);
  if (params?.q) qs.set("q", params.q);
  const q = qs.toString();
  return platformFetch<
    {
      id: string;
      recipientPhone: string;
      recipientName: string | null;
      senderId: string;
      body: string;
      status: string;
      creditsUsed: number;
      error: string | null;
      createdAt: string;
      school: { name: string; subdomain: string };
    }[]
  >(`/platform/sms/messages${q ? `?${q}` : ""}`);
}

// ── WaafiPay gateway ───────────────────────────────────────────────────────

export interface PlatformWaafiConfig {
  id: string;
  enabled: boolean;
  baseUrl: string;
  merchantUid: string;
  apiUserId: string;
  hasApiKey: boolean;
  storeId: string;
  hasHppKey: boolean;
  defaultMethod: "API_PURCHASE" | "HPP_PURCHASE";
  currency: string;
  callbackBaseUrl: string | null;
  connectionStatus: "CONNECTED" | "DISCONNECTED" | "ERROR";
  connectionMessage: string | null;
  lastTestedAt: string | null;
  lastSuccessAt: string | null;
  connectionVerified: boolean;
  simulationMode: boolean;
  paymentsUnlocked: boolean;
  updatedAt: string;
}

export interface PlatformWaafiTest {
  ok: boolean;
  status: "CONNECTED" | "DISCONNECTED" | "ERROR";
  message: string;
  steps: { step: string; ok: boolean; message: string }[];
  testedAt: string;
}

export interface PlatformSmsPaymentOverview {
  config: PlatformWaafiConfig;
  orders: {
    id: string;
    referenceId: string;
    receiptNumber: string | null;
    status: string;
    amount: string | number;
    currency: string;
    credits: number;
    channel: string;
    payerAccount: string | null;
    waafiTransactionId: string | null;
    paidAt: string | null;
    createdAt: string;
    failureReason: string | null;
    school: { id: string; name: string; subdomain: string };
    package: { id: string; name: string; credits: number };
    purchase: { id: string; creditsRemaining: number; status: string } | null;
  }[];
  statusBreakdown: { status: string; count: number; amount: string | number }[];
  revenue: {
    totalAmount: string | number;
    totalCredits: number;
    successfulPayments: number;
  };
}

export async function fetchPlatformWaafiConfig() {
  return platformFetch<PlatformWaafiConfig>("/platform/sms/waafi/config");
}

export async function testPlatformWaafiConnection(body: {
  baseUrl?: string;
  merchantUid?: string;
  apiUserId?: string;
  apiKey?: string;
  storeId?: string;
  hppKey?: string;
  defaultMethod?: "API_PURCHASE" | "HPP_PURCHASE";
  currency?: string;
  callbackBaseUrl?: string | null;
  saveOnSuccess?: boolean;
  enabled?: boolean;
}) {
  return platformFetch<{ config: PlatformWaafiConfig; test: PlatformWaafiTest }>(
    "/platform/sms/waafi/test-connection",
    { method: "POST", body },
  );
}

export async function updatePlatformWaafiConfig(body: {
  enabled?: boolean;
  simulationMode?: boolean;
  defaultMethod?: "API_PURCHASE" | "HPP_PURCHASE";
  currency?: string;
  callbackBaseUrl?: string | null;
}) {
  return platformFetch<PlatformWaafiConfig>("/platform/sms/waafi/config", {
    method: "PATCH",
    body,
  });
}

export async function fetchPlatformSmsPayments() {
  return platformFetch<PlatformSmsPaymentOverview>("/platform/sms/payments");
}

export async function deletePlatformSmsPackage(id: string) {
  return platformFetch(`/platform/sms/packages/${id}`, { method: "DELETE" });
}

// ── School Subscriptions (billing plans) ────────────────────────────────────

export interface PlatformSubscriptionPlan {
  id: string;
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  durationDays: number;
  aiGradingMonthlyQuota: number | null;
  libraryStorageMb: number | null;
  priceUsd: string | number | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PlatformSchoolSubscriptionRow {
  school: {
    id: string;
    name: string;
    subdomain: string;
    status: "ACTIVE" | "SUSPENDED";
  };
  studentCount: number;
  subscription: {
    id: string;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: string;
    endDate: string;
    aiGradingUsed: number;
    assignedByAdminId?: string | null;
    assignedByUsername?: string | null;
    daysRemaining?: number;
    plan: PlatformSubscriptionPlan;
  } | null;
}

export interface PlatformSubscriptionDashboard {
  totalSchools: number;
  activeSchools: number;
  expiredSchools: number;
  cancelledSchools: number;
  unassignedSchools: number;
  expiringSoon: number;
  totalAiUsage: number;
  totalAiQuota: number | null;
  studentUsage: number;
  studentCap: number | null;
  subscriptionStatus: {
    ACTIVE: number;
    EXPIRED: number;
    CANCELLED: number;
    UNASSIGNED: number;
  };
}

export interface PlatformSubscriptionHistoryRow {
  id: string;
  school: { id: string; name: string; subdomain: string };
  plan: string;
  planId: string;
  assignedBy: string;
  assignedDate: string;
  expiredDate: string;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
  action: string;
  createdAt: string;
}

export interface PlatformSubscriptionHistoryPage {
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
  rows: PlatformSubscriptionHistoryRow[];
}

export interface PlatformSchoolSubscriptionDetail {
  school: {
    id: string;
    name: string;
    subdomain: string;
    status: string;
    createdAt: string;
  };
  studentCount: number;
  subscription: {
    id: string;
    status: "ACTIVE" | "EXPIRED" | "CANCELLED";
    startDate: string;
    endDate: string;
    daysRemaining: number;
    assignedByAdminId: string | null;
    assignedByUsername: string | null;
    assignedAt: string;
    studentLimit: number | null;
    studentsUsed: number;
    studentsRemaining: number | null;
    aiLimit: number | null;
    aiUsed: number;
    aiRemaining: number | null;
    plan: PlatformSubscriptionPlan;
  } | null;
}

export interface PlatformSubscriptionAlert {
  school: { id: string; name: string; subdomain: string };
  planName: string;
  endDate: string;
  daysRemaining: number;
  status: "ACTIVE" | "EXPIRED" | "CANCELLED";
}

export const fetchPlatformSubscriptionDashboard = () =>
  platformFetch<PlatformSubscriptionDashboard>("/platform/subscriptions/dashboard");

export const fetchPlatformSubscriptionAlerts = () =>
  platformFetch<PlatformSubscriptionAlert[]>("/platform/subscriptions/alerts");

export const fetchPlatformSubscriptionHistory = (params?: {
  search?: string;
  status?: string;
  page?: number;
  pageSize?: number;
}) => {
  const q = new URLSearchParams();
  if (params?.search) q.set("search", params.search);
  if (params?.status) q.set("status", params.status);
  if (params?.page) q.set("page", String(params.page));
  if (params?.pageSize) q.set("pageSize", String(params.pageSize));
  const qs = q.toString();
  return platformFetch<PlatformSubscriptionHistoryPage>(
    `/platform/subscriptions/history${qs ? `?${qs}` : ""}`,
  );
};

export const fetchPlatformSchoolSubscriptionDetail = (schoolId: string) =>
  platformFetch<PlatformSchoolSubscriptionDetail>(
    `/platform/subscriptions/schools/${schoolId}`,
  );

export const fetchPlatformSubscriptionPlans = () =>
  platformFetch<PlatformSubscriptionPlan[]>("/platform/subscriptions/plans");

export const createPlatformSubscriptionPlan = (body: {
  name: string;
  maxStudents: number | null;
  maxTeachers: number | null;
  durationDays: number;
  aiGradingMonthlyQuota: number | null;
  libraryStorageMb?: number | null;
  priceUsd?: number | null;
  isActive?: boolean;
}) =>
  platformFetch<PlatformSubscriptionPlan>("/platform/subscriptions/plans", {
    method: "POST",
    body,
  });

export const updatePlatformSubscriptionPlan = (
  id: string,
  body: Partial<{
    name: string;
    maxStudents: number | null;
    maxTeachers: number | null;
    durationDays: number;
    aiGradingMonthlyQuota: number | null;
    libraryStorageMb: number | null;
    priceUsd: number | null;
    isActive: boolean;
  }>,
) =>
  platformFetch<PlatformSubscriptionPlan>(`/platform/subscriptions/plans/${id}`, {
    method: "PATCH",
    body,
  });

export const deletePlatformSubscriptionPlan = (id: string) =>
  platformFetch(`/platform/subscriptions/plans/${id}`, { method: "DELETE" });

export const fetchPlatformSchoolSubscriptions = () =>
  platformFetch<PlatformSchoolSubscriptionRow[]>("/platform/subscriptions/schools");

export const assignPlatformSchoolSubscription = (
  schoolId: string,
  body: { planId: string; startDate?: string },
) =>
  platformFetch<unknown>(`/platform/subscriptions/schools/${schoolId}/assign`, {
    method: "POST",
    body,
  });

export const cancelPlatformSchoolSubscription = (schoolId: string) =>
  platformFetch<unknown>(`/platform/subscriptions/schools/${schoolId}/cancel`, {
    method: "POST",
  });
