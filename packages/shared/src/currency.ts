/**
 * The currency registry — pure data and formatting, shared by the API (report
 * PDFs, SMS text) and the web app (every on-screen amount), so a school's
 * currency choice reads the same everywhere instead of drifting between two
 * copies of the same table.
 *
 * Symbols deliberately contain no "." — the web report chart converts a
 * formatted amount back to a number with /[^\d.-]/, and a dot inside the
 * symbol would corrupt that back-conversion.
 */
export interface CurrencyDef {
  code: string;
  symbol: string;
  /** Decimal places used when an amount is shown in full. */
  decimals: number;
}

export const CURRENCIES: Record<string, CurrencyDef> = {
  USD: { code: "USD", symbol: "$", decimals: 2 },
  ETB: { code: "ETB", symbol: "Br", decimals: 2 },
  KES: { code: "KES", symbol: "KSh", decimals: 2 },
  // The Somali shilling trades in thousands and has no circulating subunit,
  // so fractional digits would be noise rather than precision.
  SOS: { code: "SOS", symbol: "SoSh", decimals: 0 },
  EUR: { code: "EUR", symbol: "€", decimals: 2 },
};

export const CURRENCY_CODES = ["USD", "ETB", "KES", "SOS", "EUR"] as const;

export const DEFAULT_CURRENCY = CURRENCIES.USD;

/** A school saved before this list existed still formats, using its raw code. */
export function currencyByCode(code: string | null | undefined): CurrencyDef {
  if (!code) return DEFAULT_CURRENCY;
  return CURRENCIES[code] ?? { code, symbol: code, decimals: 2 };
}

const NBSP = " ";

/** "$1,234" reads as one token; a word-like symbol ("KSh") needs a separator. */
function join(symbol: string, amount: string): string {
  return symbol.length > 1 ? `${symbol}${NBSP}${amount}` : `${symbol}${amount}`;
}

/** Format an amount in a school's currency, e.g. "$1,234.00" or "SoSh 1,234". */
export function formatMoney(
  n: number,
  currencyCode: string | null | undefined,
  opts: { decimals?: number; bare?: boolean } = {},
): string {
  const cur = currencyByCode(currencyCode);
  const decimals = opts.decimals ?? cur.decimals;
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return opts.bare ? amount : join(cur.symbol, amount);
}
