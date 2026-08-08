"use client";

import { useSyncExternalStore } from "react";
import { getSettings, subscribeSettings } from "./store";
import {
  currencyByCode,
  DEFAULT_CURRENCY,
  formatCompactWithCurrency,
  formatWithCurrency,
  type CurrencyDef,
  type FormatMoneyOptions,
} from "./currency-defs";

export {
  CURRENCIES,
  CURRENCY_CODES,
  currencyByCode,
  type CurrencyDef,
  type FormatMoneyOptions,
} from "./currency-defs";

/**
 * One school-wide currency, chosen in School Settings. Every amount the
 * system shows — fees, salaries, expenses, reports, receipts, charts —
 * formats through here, so switching the setting switches the whole system.
 *
 * Read synchronously so plain formatters and print/PDF builders (which are
 * not React components) can use it too.
 */
export function activeCurrency(): CurrencyDef {
  return currencyByCode(getSettings().school.currency);
}

export function currencySymbol(): string {
  return activeCurrency().symbol;
}

/** Format an amount in the school's currency, e.g. "$1,234.00", "SoSh 45,000". */
export function formatMoney(n: number, opts: FormatMoneyOptions = {}): string {
  return formatWithCurrency(n, activeCurrency(), opts);
}

export function formatMoneyCompact(n: number): string {
  return formatCompactWithCurrency(n, activeCurrency());
}

/** Reactive variant, so a component re-renders when the school switches currency. */
export function useCurrency(): CurrencyDef {
  return useSyncExternalStore(
    subscribeSettings,
    activeCurrency,
    () => DEFAULT_CURRENCY,
  );
}
