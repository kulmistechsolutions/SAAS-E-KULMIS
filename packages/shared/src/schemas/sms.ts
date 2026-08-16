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

/** School saves/tests its own gateway credentials (Hormuud or Dhambaal). */
export const schoolSmsGatewaySchema = z.object({
  provider: z.enum(["HORMUUD", "DHAMBAAL"]).optional(),
  baseUrl: z.string().url().optional(),
  username: z.string().trim().min(1).optional(),
  /** Blank = keep the stored password (the API never sends it back). */
  password: z.string().optional(),
  /** Bearer token for DHAMBAAL. Blank = keep the stored token. */
  apiToken: z.string().optional(),
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
  reminderIntervalDays: z
    .number()
    .int()
    .positive()
    .max(90)
    .optional()
    .nullable(),
});

/**
 * What a school may change about its own SMS. The sending name is NOT here:
 * an operator registers a sender ID against a licensed organisation, so it is
 * applied for and granted by the platform owner (see
 * `requestSmsSenderIdSchema`), never typed by the school.
 */
export const updateSchoolSmsSettingsSchema = z.object({
  smsEnabled: z.boolean().optional(),
});

/** A sender ID as the operator accepts it: A–Z, digits, space, dash, max 11. */
const senderIdName = z
  .string()
  .trim()
  .min(3, "Use at least 3 characters")
  .max(11, "Operators allow at most 11 characters")
  .regex(
    /^[A-Za-z0-9][A-Za-z0-9 .-]*$/,
    "Letters, digits, spaces, dots and dashes only",
  );

/** A school applying for the name recipients will see on its messages. */
export const requestSmsSenderIdSchema = z.object({
  requestedName: senderIdName,
  contactPerson: z.string().trim().min(1).max(80).optional().nullable(),
  contactPhone: z.string().trim().min(6).max(20).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
  /** Registration / licence document, base64, with its original filename. */
  licenseDoc: z.string().min(1).optional().nullable(),
  licenseDocName: z.string().trim().min(1).max(200).optional().nullable(),
  licenseDocMime: z.string().trim().min(1).max(120).optional().nullable(),
});
export type RequestSmsSenderIdInput = z.infer<typeof requestSmsSenderIdSchema>;

/**
 * The platform owner's decision. On approval they type the name actually
 * registered with the operator, which may differ from what was asked for.
 */
export const reviewSmsSenderIdSchema = z.object({
  approvedName: senderIdName.optional(),
  reviewNote: z.string().trim().max(500).optional().nullable(),
  /**
   * Required to approve (not to reject): a real phone number the approval
   * flow sends one live test SMS to, using the candidate sender ID, so an
   * unregistered-with-Hormuud name is caught before it goes live rather than
   * discovered later from a school's failed delivery log.
   */
  testPhone: z.string().trim().min(6).max(20).optional(),
});
export type ReviewSmsSenderIdInput = z.infer<typeof reviewSmsSenderIdSchema>;

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
  /** Shown to schools instead of the automatic payment form when `enabled`
   *  is off — the mobile money number to send payment to manually. */
  manualPaymentNumber: z.string().max(30).nullable().optional(),
  manualPaymentInstructions: z.string().max(500).nullable().optional(),
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

export type UpdateSmsGlobalConfigInput = z.infer<
  typeof updateSmsGlobalConfigSchema
>;
export type CreateSmsPackageInput = z.infer<typeof createSmsPackageSchema>;
export type UpdateSmsPackageInput = z.infer<typeof updateSmsPackageSchema>;
export type AssignSmsPackageInput = z.infer<typeof assignSmsPackageSchema>;
export type SendSmsInput = z.infer<typeof sendSmsSchema>;
export type SendAudienceSmsInput = z.infer<typeof sendAudienceSmsSchema>;
export type PreviewAudienceInput = z.infer<typeof previewAudienceSchema>;
export type CreateSmsTemplateInput = z.infer<typeof createSmsTemplateSchema>;
export type CreateSmsCampaignInput = z.infer<typeof createSmsCampaignSchema>;
export type UpdateWaafiConfigInput = z.infer<typeof updateWaafiConfigSchema>;
export type TestWaafiConnectionInput = z.infer<
  typeof testWaafiConnectionSchema
>;
export type PurchaseSmsPackageInput = z.infer<typeof purchaseSmsPackageSchema>;
