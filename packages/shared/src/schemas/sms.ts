import { z } from "zod";

export const SmsCategory = {
  CUSTOM: "CUSTOM",
  FEE_REMINDER: "FEE_REMINDER",
  ANNOUNCEMENT: "ANNOUNCEMENT",
  EMERGENCY: "EMERGENCY",
  ATTENDANCE: "ATTENDANCE",
  EXAM_ANNOUNCEMENT: "EXAM_ANNOUNCEMENT",
  EXAM_RESULT: "EXAM_RESULT",
  ADMISSION: "ADMISSION",
  REGISTRATION: "REGISTRATION",
  PAYMENT_CONFIRMATION: "PAYMENT_CONFIRMATION",
} as const;

export type SmsCategory = (typeof SmsCategory)[keyof typeof SmsCategory];

export const smsCategorySchema = z.nativeEnum(SmsCategory);

export const updateSmsGlobalConfigSchema = z.object({
  enabled: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  defaultSenderId: z.string().max(20).nullable().optional(),
});

/** Draft credentials for Test Connection (password optional if already saved). */
export const testSmsConnectionSchema = z.object({
  baseUrl: z.string().url().optional(),
  username: z.string().min(1).optional(),
  password: z.string().optional(),
  /** When true, persist credentials only if the test succeeds. */
  saveOnSuccess: z.boolean().optional(),
  enabled: z.boolean().optional(),
  defaultSenderId: z.string().max(20).nullable().optional(),
});

export type TestSmsConnectionInput = z.infer<typeof testSmsConnectionSchema>;

export const createSmsPackageSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional().nullable(),
  credits: z.number().int().positive(),
  price: z.number().nonnegative(),
  currency: z.string().min(1).max(8).default("USD"),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

export const updateSmsPackageSchema = createSmsPackageSchema.partial();

export const assignSmsPackageSchema = z.object({
  schoolId: z.string().min(1),
  packageId: z.string().min(1),
  note: z.string().max(500).optional().nullable(),
  expiresAt: z.string().datetime().optional().nullable(),
});

export const adjustSmsCreditsSchema = z.object({
  schoolId: z.string().min(1),
  purchaseId: z.string().min(1).optional(),
  credits: z.number().int(),
  description: z.string().max(500).optional(),
});

export const smsRecipientSchema = z.object({
  phone: z.string().min(6).max(20),
  name: z.string().max(120).optional().nullable(),
  type: z.enum(["PARENT", "STUDENT", "TEACHER", "STAFF", "OTHER"]).optional(),
  refId: z.string().optional().nullable(),
  variables: z.record(z.string()).optional(),
});

export const sendSmsSchema = z.object({
  category: smsCategorySchema.default(SmsCategory.CUSTOM),
  body: z.string().min(1).max(1000),
  templateId: z.string().optional(),
  recipients: z.array(smsRecipientSchema).min(1).max(500),
  scheduledAt: z.string().datetime().optional().nullable(),
});

export const sendAudienceSmsSchema = z.object({
  category: smsCategorySchema.default(SmsCategory.CUSTOM),
  body: z.string().min(1).max(1000),
  templateId: z.string().optional(),
  audience: z.enum([
    "ALL_PARENTS",
    "CLASS",
    "SECTION",
    "TEACHERS",
    "OUTSTANDING",
    "CUSTOM",
  ]),
  classId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  parentIds: z.array(z.string()).optional(),
  studentIds: z.array(z.string()).optional(),
  teacherIds: z.array(z.string()).optional(),
  scheduledAt: z.string().datetime().optional().nullable(),
  campaignName: z.string().max(120).optional(),
});

// ── School's own SMS gateway (paid add-on) ─────────────────────────────────

/** School saves/tests its own Hormuud credentials. */
export const schoolSmsGatewaySchema = z.object({
  baseUrl: z.string().url().optional(),
  username: z.string().trim().min(1).optional(),
  /** Blank = keep the stored password (the API never sends it back). */
  password: z.string().optional(),
  senderId: z.string().trim().max(20).nullable().optional(),
  /** Persist the credentials only if the test succeeds. */
  saveOnSuccess: z.boolean().optional(),
  enabled: z.boolean().optional(),
});
export type SchoolSmsGatewayInput = z.infer<typeof schoolSmsGatewaySchema>;

/** Super Admin grants/renews a school's gateway licence. */
export const grantSmsGatewayLicenseSchema = z.object({
  schoolId: z.string().min(1),
  durationMonths: z.number().int().positive().max(60),
  price: z.number().nonnegative().nullable().optional(),
  currency: z.string().min(3).max(8).optional(),
  note: z.string().max(500).nullable().optional(),
});
export type GrantSmsGatewayLicenseInput = z.infer<
  typeof grantSmsGatewayLicenseSchema
>;

export const previewAudienceSchema = z.object({
  audience: z.enum([
    "ALL_PARENTS",
    "CLASS",
    "SECTION",
    "TEACHERS",
    "OUTSTANDING",
    "CUSTOM",
  ]),
  classId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
});

export const createSmsTemplateSchema = z.object({
  name: z.string().min(1).max(120),
  category: smsCategorySchema.default(SmsCategory.CUSTOM),
  body: z.string().min(1).max(1000),
  isActive: z.boolean().optional(),
});

export const updateSmsTemplateSchema = createSmsTemplateSchema.partial();

export const createSmsCampaignSchema = z.object({
  name: z.string().min(1).max(120),
  category: smsCategorySchema.default(SmsCategory.FEE_REMINDER),
  body: z.string().min(1).max(1000),
  audience: z
    .enum(["ALL_PARENTS", "CLASS", "SECTION", "OUTSTANDING", "CUSTOM"])
    .default("OUTSTANDING"),
  classId: z.string().optional().nullable(),
  sectionId: z.string().optional().nullable(),
  scheduledAt: z.string().datetime().optional().nullable(),
  reminderIntervalDays: z.number().int().positive().max(90).optional().nullable(),
});

export const updateSchoolSmsSettingsSchema = z.object({
  smsSenderName: z.string().min(1).max(20).nullable().optional(),
  smsEnabled: z.boolean().optional(),
});

// ── WaafiPay payment gateway (Super Admin) ─────────────────────────────────

export const updateWaafiConfigSchema = z.object({
  enabled: z.boolean().optional(),
  /** Dev/demo only — unlocks purchases without live Waafi credentials. */
  simulationMode: z.boolean().optional(),
  baseUrl: z.string().url().optional(),
  merchantUid: z.string().min(1).max(40).optional(),
  apiUserId: z.string().max(40).optional(),
  apiKey: z.string().max(80).optional(),
  storeId: z.string().max(40).optional(),
  hppKey: z.string().max(80).optional(),
  defaultMethod: z.enum(["API_PURCHASE", "HPP_PURCHASE"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  callbackBaseUrl: z
    .string()
    .url()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export const testWaafiConnectionSchema = z.object({
  baseUrl: z.string().url().optional(),
  merchantUid: z.string().min(1).max(40).optional(),
  apiUserId: z.string().max(40).optional(),
  apiKey: z.string().max(80).optional(),
  storeId: z.string().max(40).optional(),
  hppKey: z.string().max(80).optional(),
  defaultMethod: z.enum(["API_PURCHASE", "HPP_PURCHASE"]).optional(),
  currency: z.string().min(3).max(8).optional(),
  callbackBaseUrl: z.string().url().nullable().optional(),
  saveOnSuccess: z.boolean().optional(),
  enabled: z.boolean().optional(),
});

export const purchaseSmsPackageSchema = z.object({
  packageId: z.string().min(1),
  /** Mobile wallet number in international format (required for API_PURCHASE). */
  payerAccount: z.string().min(8).max(20).optional(),
  /** Override channel; defaults to Super Admin Waafi config. */
  channel: z.enum(["API_PURCHASE", "HPP_PURCHASE"]).optional(),
  paymentMethod: z.string().min(3).max(40).optional(),
});

export type UpdateSmsGlobalConfigInput = z.infer<typeof updateSmsGlobalConfigSchema>;
export type CreateSmsPackageInput = z.infer<typeof createSmsPackageSchema>;
export type UpdateSmsPackageInput = z.infer<typeof updateSmsPackageSchema>;
export type AssignSmsPackageInput = z.infer<typeof assignSmsPackageSchema>;
export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type SendAudienceSmsInput = z.infer<typeof sendAudienceSmsSchema>;
export type PreviewAudienceInput = z.infer<typeof previewAudienceSchema>;
export type CreateSmsTemplateInput = z.infer<typeof createSmsTemplateSchema>;
export type CreateSmsCampaignInput = z.infer<typeof createSmsCampaignSchema>;
export type UpdateWaafiConfigInput = z.infer<typeof updateWaafiConfigSchema>;
export type TestWaafiConnectionInput = z.infer<typeof testWaafiConnectionSchema>;
export type PurchaseSmsPackageInput = z.infer<typeof purchaseSmsPackageSchema>;
