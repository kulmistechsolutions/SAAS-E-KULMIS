/**
 * What a quantity of SMS costs when a school picks the quantity itself.
 *
 * A school that needs 640 messages should not have to buy 1,000, and the
 * platform should not have to invent a package every time somebody asks. One
 * rate, with a floor and a ceiling, prices anything in between.
 *
 * The price is computed here and nowhere else — never sent by the browser.
 * A price the buyer can name is not a price, and this one is charged to a
 * mobile wallet.
 */

export interface CustomSmsRate {
  /** Null, zero or negative means the platform is not selling custom amounts. */
  pricePerSms: number | null;
  minSms: number;
  maxSms: number;
  currency: string;
}

export interface CustomSmsQuote {
  credits: number;
  /** Rounded to the cent, and never below one — a sale is not free. */
  amount: number;
  pricePerSms: number;
  currency: string;
}

export class CustomQuoteError extends Error {}

export function customSmsEnabled(rate: CustomSmsRate): boolean {
  return typeof rate.pricePerSms === "number" && rate.pricePerSms > 0;
}

export function quoteCustomSms(
  credits: number,
  rate: CustomSmsRate,
): CustomSmsQuote {
  if (!customSmsEnabled(rate) || rate.pricePerSms === null) {
    throw new CustomQuoteError(
      "Custom SMS amounts are not on sale. Choose one of the packages.",
    );
  }
  if (!Number.isInteger(credits) || credits <= 0) {
    throw new CustomQuoteError("Enter how many SMS you want, as a whole number.");
  }
  if (credits < rate.minSms) {
    throw new CustomQuoteError(
      `The smallest custom amount is ${rate.minSms} SMS.`,
    );
  }
  if (credits > rate.maxSms) {
    throw new CustomQuoteError(
      `The largest custom amount is ${rate.maxSms.toLocaleString()} SMS. ` +
        "For more than that, ask the platform to set up a package.",
    );
  }

  // Rounded up to the cent: rounding down would hand out fractions of a
  // message for free on every order, and they add up across schools.
  const raw = credits * rate.pricePerSms;
  const amount = Math.ceil(raw * 100) / 100;

  return {
    credits,
    amount: Math.max(amount, 0.01),
    pricePerSms: rate.pricePerSms,
    currency: rate.currency || "USD",
  };
}
