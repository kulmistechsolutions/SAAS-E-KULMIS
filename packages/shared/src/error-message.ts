/**
 * The sentence a person reads when the server refuses a request.
 *
 * Most refusals carry a `message`. A form rejected by validation does not: it
 * carries `{ fieldErrors: { salary: ["Expected integer, received float"] } }`,
 * and a client that only looks for `message` falls back to the status text —
 * so a school registering a teacher with a salary of 3.5 was told "Bad
 * Request", with nothing to say which box was wrong or why.
 */

/** "fullName" → "Full name". */
function fieldLabel(key: string): string {
  const spaced = key
    .replace(/\.\d+(\.|$)/g, "$1")
    .replace(/[._]/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .trim()
    .toLowerCase();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** The common validation phrasings, put the way a person would say them. */
function plain(message: string): string {
  const m = message.trim();
  if (/expected integer, received float/i.test(m)) return "must be a whole number, with no decimals";
  if (/expected number, received (nan|string)/i.test(m)) return "must be a number";
  if (/^required$/i.test(m) || /received undefined|received null/i.test(m)) return "is required";
  if (/invalid email/i.test(m)) return "is not a valid email address";
  if (/String must contain at least (\d+)/i.test(m)) {
    return `is too short (at least ${/at least (\d+)/i.exec(m)![1]} characters)`;
  }
  if (/Number must be greater than or equal to (\S+)/i.test(m)) {
    return `must be ${/equal to (\S+)/i.exec(m)![1]} or more`;
  }
  if (/Number must be less than or equal to (\S+)/i.test(m)) {
    return `must be ${/equal to (\S+)/i.exec(m)![1]} or less`;
  }
  return m.charAt(0).toLowerCase() + m.slice(1);
}

export function messageFromErrorBody(data: unknown, fallback: string): string {
  if (!data || typeof data !== "object") return fallback;
  const d = data as {
    message?: unknown;
    fieldErrors?: Record<string, unknown>;
    formErrors?: unknown;
  };

  if (typeof d.message === "string" && d.message) return d.message;
  if (Array.isArray(d.message) && d.message.length) return d.message.join(", ");

  const parts: string[] = [];
  if (d.fieldErrors && typeof d.fieldErrors === "object") {
    for (const [key, list] of Object.entries(d.fieldErrors)) {
      const msgs = (Array.isArray(list) ? list : [list]).filter(
        (x): x is string => typeof x === "string" && x.length > 0,
      );
      if (msgs.length === 0) continue;
      const text = msgs.map(plain).join(" and ");
      // A message that is already a sentence ("Select at least one shift")
      // reads better without the field name bolted on in front of it.
      const sentence = /^[A-Z]/.test(msgs[0]!) && !/^(Expected|Required|Invalid|String|Number)/.test(msgs[0]!);
      parts.push(sentence ? msgs.join(" ") : `${fieldLabel(key)} ${text}`);
    }
  }
  if (Array.isArray(d.formErrors)) {
    for (const f of d.formErrors) if (typeof f === "string" && f) parts.push(f);
  }
  return parts.length ? parts.join(". ") + "." : fallback;
}
