"use client";

/**
 * What a message costs before it is sent.
 *
 * Somali text is plain Latin, so a message normally fits the GSM-7 alphabet
 * (160 characters in one segment, 153 each once it splits). Any character
 * outside it — an emoji, a curly quote pasted from Word — forces UCS-2 billing
 * instead (70/67), which silently more than doubles the cost of the same
 * sentence. A school that pastes a message from a document and sends it to
 * four hundred parents pays for that without being told, so it is flagged.
 *
 * Lives here rather than beside the one screen that first needed it, because
 * the composer and the template editor must agree to the character: two copies
 * of this arithmetic is how a school is quoted one price and charged another.
 */

const GSM7_RE =
  /^[A-Za-z0-9@£$¥èéùìòÇØøÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !"#¤%&'()*+,\-./:;<=>?¡ÄÖÑÜ§¿äöñüà\n\r\t^{}\\[~\]|€]*$/;

export interface SmsCost {
  chars: number;
  /** Segments one recipient's copy will be split into. Zero for an empty body. */
  segments: number;
  /** True when a character forced the expensive alphabet. */
  ucs2: boolean;
}

export function smsCost(body: string): SmsCost {
  const chars = body.length;
  const ucs2 = !GSM7_RE.test(body);
  const single = ucs2 ? 70 : 160;
  const multi = ucs2 ? 67 : 153;
  const segments =
    chars === 0 ? 0 : chars <= single ? 1 : Math.ceil(chars / multi);
  return { chars, segments, ucs2 };
}

/**
 * Credits a send will actually consume: one per segment, per recipient.
 *
 * The figure a school needs before pressing send, and the one it has never
 * been shown — the button said how many people, never how much it would cost.
 */
export function creditsFor(body: string, recipients: number): number {
  return smsCost(body).segments * Math.max(0, recipients);
}
