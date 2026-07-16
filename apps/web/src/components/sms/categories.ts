import type { SmsCategory } from "@/lib/sms/api";

export const CATEGORIES: { value: SmsCategory; label: string }[] = [
  { value: "CUSTOM", label: "Custom" },
  { value: "FEE_REMINDER", label: "Fee reminder" },
  { value: "ANNOUNCEMENT", label: "Announcement" },
  { value: "EMERGENCY", label: "Emergency" },
  { value: "ATTENDANCE", label: "Attendance" },
  { value: "EXAM_ANNOUNCEMENT", label: "Exam announcement" },
  { value: "EXAM_RESULT", label: "Exam result" },
  { value: "ADMISSION", label: "Admission" },
  { value: "REGISTRATION", label: "Registration" },
  { value: "PAYMENT_CONFIRMATION", label: "Payment confirmation" },
];
