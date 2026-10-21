import { DEFAULT_LOCALE, INTL_TAG, type Locale } from './locales';

/*
 * Locale-aware formatting on top of `Intl`. Every function takes the locale
 * explicitly; the "active locale" below only exists so shared helpers
 * (`src/lib/planDates.ts`) can default to it without a hook.
 */

let activeLocale: Locale = DEFAULT_LOCALE;

export function getActiveLocale(): Locale {
  return activeLocale;
}

/** Called by `I18nProvider`; do not call from components. */
export function setActiveLocale(locale: Locale): void {
  activeLocale = locale;
}

export function formatNumber(locale: Locale, value: number, options?: Intl.NumberFormatOptions): string {
  return new Intl.NumberFormat(INTL_TAG[locale], options).format(value);
}

export type DateInput = Date | number;

const DEFAULT_DATE_OPTIONS: Intl.DateTimeFormatOptions = { day: 'numeric', month: 'short', year: 'numeric' };

/** `value` is a Date or an epoch in milliseconds. */
export function formatDate(locale: Locale, value: DateInput, options: Intl.DateTimeFormatOptions = DEFAULT_DATE_OPTIONS): string {
  return new Intl.DateTimeFormat(INTL_TAG[locale], options).format(value);
}

const RELATIVE_STEPS: ReadonlyArray<{ unit: Intl.RelativeTimeFormatUnit; ms: number }> = [
  { unit: 'day', ms: 86_400_000 },
  { unit: 'hour', ms: 3_600_000 },
  { unit: 'minute', ms: 60_000 },
];

/** "5 min ago", "yesterday", "now": picks the largest fitting unit. */
export function formatRelative(locale: Locale, target: DateInput, now: number = Date.now()): string {
  const formatter = new Intl.RelativeTimeFormat(INTL_TAG[locale], { numeric: 'auto', style: 'short' });
  const diff = (typeof target === 'number' ? target : target.getTime()) - now;
  const step = RELATIVE_STEPS.find((item) => Math.abs(diff) >= item.ms);
  if (!step) return formatter.format(0, 'second');
  return formatter.format(Math.trunc(diff / step.ms), step.unit);
}

/** "in 3 days", "yesterday": whole-day offsets (negative = past). */
export function formatRelativeDays(locale: Locale, days: number): string {
  return new Intl.RelativeTimeFormat(INTL_TAG[locale], { numeric: 'auto' }).format(days, 'day');
}

/** Abbreviated month name without the trailing dot ("out", "Oct"). `index` is 0 to 11. */
export function monthShortName(locale: Locale, index: number): string {
  const month = ((index % 12) + 12) % 12;
  return new Intl.DateTimeFormat(INTL_TAG[locale], { month: 'short', timeZone: 'UTC' })
    .format(Date.UTC(2026, month, 15))
    .replace(/\.$/, '');
}
