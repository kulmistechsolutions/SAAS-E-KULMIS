/**
 * The currency registry — pure data and pure formatting, with no dependency
 * on the settings store, so modules the store itself imports (settings/api)
 * can use it without creating an import cycle. Read the school's *active*
 * currency through `./currency` instead.
 *
 * Symbols deliberately contain no "." — the report chart converts a formatted
 * amount back to a number with /[^\d.-]/ (components/reports/report-chart.tsx),
 * and a dot inside the symbol would corrupt that back-conversion.
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

/** Order shown in the School Settings picker. */
export const CURRENCY_CODES = ["USD", "ETB", "KES", "SOS", "EUR"] as const;

export const DEFAULT_CURRENCY = CURRENCIES.USD;

/** A school saved before this list existed still formats, using its raw code. */
export function currencyByCode(code: string | null | undefined): CurrencyDef {
  if (!code) return DEFAULT_CURRENCY;
  return CURRENCIES[code] ?? { code, symbol: code, decimals: 2 };
}

export interface FormatMoneyOptions {
  /** Force decimal places instead of the currency's own default. */
  decimals?: number;
  /** Amount only, no symbol — for inputs and CSV cells. */
  bare?: boolean;
}

/**
 * Non-breaking, so an amount never wraps away from its symbol — and so chart
 * libraries that word-split tick labels keep it intact (recharts renders each
 * space-separated word as its own <tspan>, which drops a normal space).
 */
const NBSP = " ";

/** "$1,234" reads as one token; a word-like symbol ("KSh") needs a separator. */
function join(symbol: string, amount: string): string {
  return symbol.length > 1 ? `${symbol}${NBSP}${amount}` : `${symbol}${amount}`;
}

export function formatWithCurrency(
  n: number,
  cur: CurrencyDef,
  opts: FormatMoneyOptions = {},
): string {
  const decimals = opts.decimals ?? cur.decimals;
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return opts.bare ? amount : join(cur.symbol, amount);
}

/** Compact form for dashboard tiles and chart axes, e.g. "$12K". */
export function formatCompactWithCurrency(n: number, cur: CurrencyDef): string {
  const abs = Math.abs(n);
  if (abs >= 1_000_000) return join(cur.symbol, `${Math.round(n / 1_000_000)}M`);
  if (abs >= 1_000) return join(cur.symbol, `${Math.round(n / 1_000)}K`);
  return join(cur.symbol, String(Math.round(n)));
}
