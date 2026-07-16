import type { SmsCategory } from "@/lib/sms/api";

export const CATEGORIES: { value: SmsCategory; label: string }[] = [
  { value: "CUSTOM", label: "Gaar ah" },
  { value: "FEE_REMINDER", label: "Xasuusin Lacag" },
  { value: "ANNOUNCEMENT", label: "Ogeysiis" },
  { value: "EMERGENCY", label: "Degdeg ah" },
  { value: "ATTENDANCE", label: "Xaadirin" },
  { value: "EXAM_ANNOUNCEMENT", label: "Ogeysiis Imtixaan" },
  { value: "EXAM_RESULT", label: "Natiijada Imtixaanka" },
  { value: "ADMISSION", label: "Diiwaan Gelin" },
  { value: "REGISTRATION", label: "Diiwaangelinta" },
  { value: "PAYMENT_CONFIRMATION", label: "Xaqiijinta Lacag" },
];
