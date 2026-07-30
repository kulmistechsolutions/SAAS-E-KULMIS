import type { TranslationKey } from "@/lib/i18n/provider";
import type { SmsCategory } from "@/lib/sms/api";

/**
 * Shared by the SMS composer and the template manager. `label` holds a
 * dictionary key rather than finished text, so the list reads in the chosen
 * language — call sites wrap it in t().
 */
export const CATEGORIES: { value: SmsCategory; label: TranslationKey }[] = [
  { value: "CUSTOM", label: "smsCategories.custom" },
  { value: "FEE_REMINDER", label: "smsCategories.feeReminder" },
  { value: "ANNOUNCEMENT", label: "smsCategories.announcement" },
  { value: "EMERGENCY", label: "smsCategories.emergency" },
  { value: "ATTENDANCE", label: "smsCategories.attendance" },
  { value: "EXAM_ANNOUNCEMENT", label: "smsCategories.examAnnouncement" },
  { value: "EXAM_RESULT", label: "smsCategories.examResult" },
  { value: "ADMISSION", label: "smsCategories.admission" },
  { value: "REGISTRATION", label: "smsCategories.registration" },
  { value: "PAYMENT_CONFIRMATION", label: "smsCategories.paymentConfirmation" },
];
