/**
 * What an automatic message says.
 *
 * Kept apart from the sending so the wording can be read and tested without a
 * database. Every line is deliberately short: a school pays per 160 characters,
 * and these send themselves — wording that runs to two segments quietly doubles
 * a school's bill for the life of the setting.
 */
export type AutoSmsEvent = "FEE_PAID" | "REGISTERED" | "ABSENT" | "RESULT";

export interface AutoSmsVars {
  school: string;
  student: string;
  receiptNo?: string;
  amount?: string;
  outstanding?: string;
  code?: string;
  date?: string;
  exam?: string;
}

export function autoSmsBody(event: AutoSmsEvent, v: AutoSmsVars): string {
  switch (event) {
    case "FEE_PAID":
      return `${v.school}: ${v.amount} received for ${v.student}. Receipt ${v.receiptNo}. Balance ${v.outstanding}. Thank you.`;
    case "REGISTERED":
      return `${v.school}: ${v.student} is registered. Student ID ${v.code}. Welcome.`;
    case "ABSENT":
      return `${v.school}: ${v.student} was absent on ${v.date}. Please contact the school.`;
    case "RESULT":
      return `${v.school}: ${v.exam} results for ${v.student} are ready. Collect the result card.`;
  }
}
