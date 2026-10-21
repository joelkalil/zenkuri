import { formatRelativeDays, getActiveLocale, monthShortName } from '../i18n/format';
import { INTL_TAG, type Locale } from '../i18n/locales';

/*
 * Plan dates. Every plan date is 'YYYY-MM-DD' in local time. Formatters take an
 * optional locale and default to the active one (see src/i18n/README.md).
 */

export const DAY_MS = 86_400_000;
/** Window used when the plan has no phases, vacations or dated milestones yet. */
export const PLAN_START = '2026-10-13';
export const PLAN_END = '2027-10-31';

interface Dated {
  start: string;
  end: string;
}

/** Earliest start and latest end among phases, vacations and dated milestones (at least 1 day). */
export function planRange(phases: Dated[], vacations: Dated[], milestoneDates: Array<string | null>): { start: string; end: string } {
  const starts = [...phases, ...vacations].map((item) => item.start);
  const ends = [...phases, ...vacations].map((item) => item.end);
  for (const date of milestoneDates) {
    if (date) {
      starts.push(date);
      ends.push(date);
    }
  }
  if (starts.length === 0) return { start: PLAN_START, end: PLAN_END };
  const start = starts.reduce((min, value) => (value < min ? value : min));
  const end = ends.reduce((max, value) => (value > max ? value : max));
  return { start, end: end > start ? end : start };
}

/** How many months (from the `start` month to the `end` month, inclusive) the year strip must show. */
export function monthSpan(start: Date, end: Date) {
  return (end.getFullYear() - start.getFullYear()) * 12 + end.getMonth() - start.getMonth() + 1;
}

/** 'YYYY-MM-DD' as a local date (without the timezone shift of ISO parsing). */
export function parseDay(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function isoDay(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / DAY_MS);
}

/** '13/10': the year only appears when it differs from today. */
export function formatDay(iso: string, today = todayStart()) {
  const [y, m, d] = iso.split('-');
  return Number(y) === today.getFullYear() ? `${d}/${m}` : `${d}/${m}/${y.slice(2)}`;
}

/** '2026-10-20' becomes '20 out 2026' (pt-BR) or '20 Oct 2026' (en): no leading zero, no trailing dot. */
export function formatDayLong(iso: string, locale: Locale = getActiveLocale()) {
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return iso;
  return `${d} ${monthShortName(locale, m - 1)} ${y}`;
}

/** Abbreviated month name by index (0 to 11), e.g. 'out' or 'Oct'. */
export function monthShort(index: number, locale: Locale = getActiveLocale()) {
  return monthShortName(locale, index);
}

/** 'YYYY-MM' becomes 'nov/26' */
export function monthKeyLabel(key: string, locale: Locale = getActiveLocale()) {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return `${monthShortName(locale, m - 1)}/${String(y).slice(2)}`;
}

/** 'YYYY-MM' becomes 'novembro de 2026' (pt-BR) or 'November 2026' (en). */
export function monthKeyLong(key: string, locale: Locale = getActiveLocale()) {
  const [y, m] = key.split('-').map(Number);
  if (!y || !m || m < 1 || m > 12) return key;
  return new Intl.DateTimeFormat(INTL_TAG[locale], { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(Date.UTC(y, m - 1, 15));
}

export function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

/** The next `count` months starting at the `from` month, as 'YYYY-MM'. */
export function upcomingMonths(from: Date, count: number) {
  return Array.from({ length: count }, (_, index) => monthKey(new Date(from.getFullYear(), from.getMonth() + index, 1)));
}

/** "today", "tomorrow", "in 37 days", "3 days ago" (localized). */
export function relativeDays(days: number, locale: Locale = getActiveLocale()) {
  return formatRelativeDays(locale, days);
}

export function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder === 0 ? `${hours} h` : `${hours} h ${remainder} min`;
}
